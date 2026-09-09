/**
 * Find fee statements with duplicate Candidate Registration Fee lines and remove extras.
 *
 * Usage:
 *   npx tsx scripts/dedupe-candidate-registration-fee-lines.ts           # dry-run
 *   npx tsx scripts/dedupe-candidate-registration-fee-lines.ts --apply   # write changes
 *
 * Keeps the earliest CANDIDATE_REGISTRATION line per statement, deletes the rest,
 * and recalculates statement totals. Paid/issued statements are reported but only
 * adjusted when --apply is set (review carefully before applying in production).
 */
import { prisma } from "../src/lib/prisma";
import { CANDIDATE_REGISTRATION_FEE_SERVICE_NAME } from "../src/lib/fees/candidate-registration-fee-constants";

const apply = process.argv.includes("--apply");

async function main() {
  const statements = await prisma.feeStatement.findMany({
    select: {
      id: true,
      statementNo: true,
      status: true,
      totalGbpAmount: true,
      totalCnyAmount: true,
      amountDueGbpAmount: true,
      amountDueCnyAmount: true,
      items: {
        where: {
          OR: [
            { serviceType: "CANDIDATE_REGISTRATION" },
            { serviceNameSnapshot: CANDIDATE_REGISTRATION_FEE_SERVICE_NAME },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          lineTotalGbp: true,
          lineTotalCny: true,
          serviceType: true,
          serviceNameSnapshot: true,
        },
      },
    },
  });

  const duplicates = statements.filter((row) => row.items.length > 1);

  if (duplicates.length === 0) {
    console.log("No fee statements with duplicate Candidate Registration Fee lines.");
    return;
  }

  console.log(
    `Found ${duplicates.length} statement(s) with duplicate Candidate Registration Fee lines.`,
  );
  console.log(apply ? "Applying fixes…" : "Dry-run only (pass --apply to write).");

  let removedItems = 0;
  let updatedStatements = 0;

  for (const statement of duplicates) {
    const [keep, ...extras] = statement.items;
    if (!keep || extras.length === 0) continue;

    const removeGbp = extras.reduce((sum, item) => sum + Number(item.lineTotalGbp), 0);
    const removeCny = extras.reduce((sum, item) => sum + Number(item.lineTotalCny), 0);
    const nextTotalGbp = Math.max(0, Number(statement.totalGbpAmount) - removeGbp);
    const nextTotalCny = Math.max(0, Number(statement.totalCnyAmount) - removeCny);

    const nextDueGbp =
      statement.amountDueGbpAmount == null
        ? null
        : Math.max(0, Number(statement.amountDueGbpAmount) - removeGbp);
    const nextDueCny =
      statement.amountDueCnyAmount == null
        ? null
        : Math.max(0, Number(statement.amountDueCnyAmount) - removeCny);

    console.log(
      [
        statement.statementNo,
        `status=${statement.status}`,
        `keep=${keep.id}`,
        `remove=${extras.length}`,
        `gbp ${Number(statement.totalGbpAmount).toFixed(2)} → ${nextTotalGbp.toFixed(2)}`,
        `cny ${Number(statement.totalCnyAmount).toFixed(2)} → ${nextTotalCny.toFixed(2)}`,
      ].join(" | "),
    );

    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      await tx.feeStatementItem.deleteMany({
        where: { id: { in: extras.map((item) => item.id) } },
      });
      await tx.feeStatement.update({
        where: { id: statement.id },
        data: {
          totalGbpAmount: nextTotalGbp,
          totalCnyAmount: nextTotalCny,
          ...(nextDueGbp != null ? { amountDueGbpAmount: nextDueGbp } : {}),
          ...(nextDueCny != null ? { amountDueCnyAmount: nextDueCny } : {}),
        },
      });
    });

    removedItems += extras.length;
    updatedStatements += 1;
  }

  if (apply) {
    console.log(`Updated ${updatedStatements} statement(s); removed ${removedItems} duplicate line(s).`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
