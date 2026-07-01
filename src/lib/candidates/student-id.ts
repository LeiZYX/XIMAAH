import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

export function formatStudentId(year: number, sequence: number): string {
  return `STU-${year}-${String(sequence).padStart(6, "0")}`;
}

export async function generateStudentId(client: DbClient = prisma): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await client.studentIdSequence.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return formatStudentId(year, seq.lastNumber);
}

export async function ensureCandidateStudentId(
  candidateId: string,
  client: DbClient = prisma,
): Promise<string> {
  const existing = await client.candidate.findUnique({
    where: { id: candidateId },
    select: { studentId: true },
  });
  if (existing?.studentId) return existing.studentId;

  const studentId = await generateStudentId(client);
  await client.candidate.update({
    where: { id: candidateId },
    data: { studentId },
  });
  return studentId;
}

export async function backfillMissingStudentIds() {
  const missing = await prisma.candidate.findMany({
    where: { studentId: "" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, createdAt: true },
  });

  // Also catch null if migration not applied yet
  const missingNull = await prisma.$queryRaw<Array<{ id: string; createdAt: Date }>>`
    SELECT id, createdAt FROM Candidate WHERE studentId IS NULL OR studentId = '' ORDER BY createdAt, id
  `.catch(() => [] as Array<{ id: string; createdAt: Date }>);

  const rows =
    missing.length > 0
      ? missing
      : missingNull;

  let updated = 0;
  for (const row of rows) {
    const year = row.createdAt.getUTCFullYear();
    await prisma.$transaction(async (tx) => {
      const seq = await tx.studentIdSequence.upsert({
        where: { year },
        create: { year, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      const studentId = formatStudentId(year, seq.lastNumber);
      await tx.candidate.update({
        where: { id: row.id },
        data: { studentId },
      });
    });
    updated += 1;
  }

  return { updated };
}
