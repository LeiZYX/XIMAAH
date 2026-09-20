import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clearSessionCookieOptions } from "@/lib/auth/session";
import { logUserAudit } from "@/lib/users/audit";

export const FEATURE_SETTINGS_ID = "default";

export const STUDENT_LOGIN_DISABLED_MESSAGE =
  "Student sign-in is temporarily closed. Contact the Exams Office.";

export type ResolvedFeatureSettings = {
  studentLoginEnabled: boolean;
  updatedAt: Date | null;
  updatedByUserId: string | null;
  updatedByName: string | null;
};

export async function ensureFeatureSettings() {
  return prisma.systemFeatureSettings.upsert({
    where: { id: FEATURE_SETTINGS_ID },
    create: { id: FEATURE_SETTINGS_ID, studentLoginEnabled: true },
    update: {},
    include: { updatedBy: { select: { name: true } } },
  });
}

export async function getFeatureSettings(): Promise<ResolvedFeatureSettings> {
  const row = await ensureFeatureSettings();
  return {
    studentLoginEnabled: row.studentLoginEnabled,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
    updatedByName: row.updatedBy?.name ?? null,
  };
}

export async function isStudentLoginEnabled(): Promise<boolean> {
  const settings = await getFeatureSettings();
  return settings.studentLoginEnabled;
}

export async function saveFeatureSettings(
  input: { studentLoginEnabled?: boolean },
  updatedByUserId: string,
): Promise<ResolvedFeatureSettings> {
  await ensureFeatureSettings();
  await prisma.systemFeatureSettings.update({
    where: { id: FEATURE_SETTINGS_ID },
    data: {
      ...(input.studentLoginEnabled !== undefined
        ? { studentLoginEnabled: input.studentLoginEnabled }
        : {}),
      updatedByUserId,
    },
  });

  const settings = await getFeatureSettings();
  await logUserAudit({
    action: "FEATURE_SETTINGS_UPDATED",
    performedById: updatedByUserId,
    targetUserId: null,
    metadata: {
      studentLoginEnabled: settings.studentLoginEnabled,
      timestamp: new Date().toISOString(),
    },
  }).catch((error) => {
    console.error("Feature settings audit failed:", error);
  });

  return settings;
}

/** Clear session cookie and return 403 when student login is disabled. */
export async function studentLoginDisabledResponse(
  role: string,
): Promise<NextResponse | null> {
  if (role !== "STUDENT") return null;
  if (await isStudentLoginEnabled()) return null;

  const response = NextResponse.json(
    { error: STUDENT_LOGIN_DISABLED_MESSAGE },
    { status: 403 },
  );
  response.cookies.set(clearSessionCookieOptions());
  return response;
}

/** For Server Components: end student session and send them to login. */
export async function redirectIfStudentLoginDisabled(role: string) {
  if (role !== "STUDENT") return;
  if (await isStudentLoginEnabled()) return;

  const jar = await cookies();
  const cleared = clearSessionCookieOptions();
  jar.set(cleared.name, cleared.value, {
    httpOnly: cleared.httpOnly,
    sameSite: cleared.sameSite,
    secure: cleared.secure,
    path: cleared.path,
    maxAge: cleared.maxAge,
  });
  redirect("/login?notice=student-login-closed");
}
