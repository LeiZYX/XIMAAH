import type { LoginLogFailureReason, LoginLogResult, UserRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { buildPaginationMeta, parseListPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const FAILURE_WINDOW_MS = 60_000;
const FAILED_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const KEPT_RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1000;

type LoginUser = {
  id: string;
  name: string;
  role: UserRole;
};

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function requestClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return clip(first, 64);
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return clip(realIp, 64);
  return "";
}

export function requestUserAgent(headers: Headers): string {
  return clip(headers.get("user-agent") ?? "", 200);
}

async function writeLoginLog(input: {
  result: LoginLogResult;
  failureReason?: LoginLogFailureReason | null;
  user?: LoginUser | null;
  identifier: string;
  ipAddress: string;
  userAgent: string;
}) {
  const identifier = clip(input.identifier, 191);
  const ipAddress = clip(input.ipAddress, 64);
  const userAgent = clip(input.userAgent, 200) || null;
  const now = new Date();

  if (input.result === "FAILED") {
    const recent = await prisma.loginLog.findFirst({
      where: {
        result: "FAILED",
        ipAddress,
        identifier,
        lastAttemptAt: { gte: new Date(now.getTime() - FAILURE_WINDOW_MS) },
      },
      orderBy: { lastAttemptAt: "desc" },
      select: { id: true },
    });
    if (recent) {
      await prisma.loginLog.update({
        where: { id: recent.id },
        data: {
          lastAttemptAt: now,
          attemptCount: { increment: 1 },
          failureReason: input.failureReason ?? null,
          ...(input.user
            ? {
                userId: input.user.id,
                nameSnapshot: input.user.name,
                roleSnapshot: input.user.role,
              }
            : {}),
        },
      });
      return;
    }
  }

  await prisma.loginLog.create({
    data: {
      occurredAt: now,
      lastAttemptAt: now,
      result: input.result,
      failureReason: input.failureReason ?? null,
      attemptCount: 1,
      userId: input.user?.id ?? null,
      nameSnapshot: input.user?.name ?? null,
      roleSnapshot: input.user?.role ?? null,
      identifier,
      ipAddress,
      userAgent,
    },
  });
}

export async function recordLoginFailure(input: {
  headers: Headers;
  identifier: string;
  user?: LoginUser | null;
  reason: LoginLogFailureReason;
}) {
  await writeLoginLog({
    result: "FAILED",
    failureReason: input.reason,
    user: input.user,
    identifier: input.identifier,
    ipAddress: requestClientIp(input.headers),
    userAgent: requestUserAgent(input.headers),
  });
}

export async function recordLoginSuccess(input: {
  headers: Headers;
  identifier: string;
  user: LoginUser;
}) {
  await writeLoginLog({
    result: "SUCCESS",
    user: input.user,
    identifier: input.identifier,
    ipAddress: requestClientIp(input.headers),
    userAgent: requestUserAgent(input.headers),
  });
}

export async function recordLogout(input: {
  headers: Headers;
  user: LoginUser;
  identifier: string;
}) {
  await writeLoginLog({
    result: "LOGOUT",
    user: input.user,
    identifier: input.identifier,
    ipAddress: requestClientIp(input.headers),
    userAgent: requestUserAgent(input.headers),
  });
}

export async function purgeExpiredLoginLogs() {
  const now = Date.now();
  await prisma.loginLog.deleteMany({
    where: {
      OR: [
        { result: "FAILED", occurredAt: { lt: new Date(now - FAILED_RETENTION_MS) } },
        {
          result: { in: ["SUCCESS", "LOGOUT"] },
          occurredAt: { lt: new Date(now - KEPT_RETENTION_MS) },
        },
      ],
    },
  });
}

function shanghaiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addShanghaiDays(date: string, days: number): string {
  const start = new Date(`${date}T00:00:00.000+08:00`);
  start.setUTCDate(start.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);
}

function shanghaiBound(date: string, end: boolean): Date {
  return new Date(`${date}T${end ? "23:59:59.999" : "00:00:00.000"}+08:00`);
}

function pinyinLikePattern(value: string): string {
  return `%${value.replace(/[%_\\]/g, "\\$&")}%`;
}

async function userIdsMatchingPinyin(query: string): Promise<string[]> {
  const compact = query.replace(/\s+/g, "");
  if (!/^[a-z0-9]+$/i.test(compact)) return [];
  const pattern = pinyinLikePattern(compact.toLowerCase());
  const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT userId FROM Candidate
    WHERE userId IS NOT NULL
      AND (
        LOWER(REPLACE(CONCAT(IFNULL(surnamePinyin, ''), IFNULL(givenNamePinyin, '')), ' ', '')) LIKE ${pattern}
        OR LOWER(REPLACE(CONCAT(IFNULL(givenNamePinyin, ''), IFNULL(surnamePinyin, '')), ' ', '')) LIKE ${pattern}
        OR LOWER(REPLACE(IFNULL(surnamePinyin, ''), ' ', '')) LIKE ${pattern}
        OR LOWER(REPLACE(IFNULL(givenNamePinyin, ''), ' ', '')) LIKE ${pattern}
        OR LOWER(REPLACE(CONCAT(IFNULL(lastName, ''), IFNULL(firstName, '')), ' ', '')) LIKE ${pattern}
        OR LOWER(REPLACE(CONCAT(IFNULL(firstName, ''), IFNULL(lastName, '')), ' ', '')) LIKE ${pattern}
      )
  `;
  return rows.map((row) => row.userId);
}

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function listLoginLogs(searchParams: URLSearchParams) {
  const today = shanghaiToday();
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";
  const from = isDay(fromParam) ? fromParam : addShanghaiDays(today, -6);
  const to = isDay(toParam) ? toParam : today;
  const result = searchParams.get("result");
  const role = searchParams.get("role");
  const query = searchParams.get("q")?.trim() ?? "";
  const { page, pageSize } = parseListPagination(searchParams);

  const where: Prisma.LoginLogWhereInput = {
    lastAttemptAt: {
      gte: shanghaiBound(from, false),
      lte: shanghaiBound(to, true),
    },
    ...(result === "SUCCESS" || result === "FAILED" || result === "LOGOUT" ? { result } : {}),
    ...(role === "ADMIN" ||
    role === "EXAM_OFFICER" ||
    role === "SUBJECT_TEACHER" ||
    role === "STUDENT"
      ? { roleSnapshot: role }
      : {}),
  };

  if (query) {
    const pinyinUserIds = await userIdsMatchingPinyin(query);
    where.OR = [
      { nameSnapshot: { contains: query } },
      { identifier: { contains: query } },
      { user: { is: { email: { contains: query } } } },
      { user: { is: { name: { contains: query } } } },
      { user: { is: { candidate: { is: { chineseName: { contains: query } } } } } },
      { user: { is: { candidate: { is: { englishName: { contains: query } } } } } },
      { user: { is: { candidate: { is: { preferredEnglishName: { contains: query } } } } } },
      { user: { is: { candidate: { is: { email: { contains: query } } } } } },
      { user: { is: { candidate: { is: { firstName: { contains: query } } } } } },
      { user: { is: { candidate: { is: { lastName: { contains: query } } } } } },
      ...(pinyinUserIds.length > 0 ? [{ userId: { in: pinyinUserIds } }] : []),
    ];
  }

  const total = await prisma.loginLog.count({ where });
  const meta = buildPaginationMeta(total, page, pageSize);
  const rows = await prisma.loginLog.findMany({
    where,
    orderBy: [{ lastAttemptAt: "desc" }, { occurredAt: "desc" }],
    skip: meta.skip,
    take: meta.pageSize,
  });

  return {
    from,
    to,
    total: meta.total,
    page: meta.page,
    totalPages: meta.totalPages,
    pageSize: meta.pageSize,
    logs: rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      lastAttemptAt: row.lastAttemptAt.toISOString(),
      result: row.result,
      failureReason: row.failureReason,
      attemptCount: row.attemptCount,
      name: row.nameSnapshot,
      role: row.roleSnapshot,
      identifier: row.identifier,
      ipAddress: row.ipAddress,
    })),
  };
}
