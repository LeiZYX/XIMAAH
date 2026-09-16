import { disconnectPrismaClient, prisma } from "@/lib/prisma";
import { backfillStudentAdjustmentHistory } from "@/lib/registrations/backfill-student-adjustment-history";

async function main() {
  const apply = process.env.APPLY === "yes";
  const result = await backfillStudentAdjustmentHistory({ apply });

  console.log(apply ? "Applied backfill:" : "Dry run (set APPLY=yes to write):");
  console.log(result);

  if (!apply && (result.batchesEnriched > 0 || result.batchesCreated > 0)) {
    console.log("\nRe-run with APPLY=yes to persist these changes.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient(prisma);
  });
