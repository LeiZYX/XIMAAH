import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatQualificationInventoryReport,
  runQualificationInventory,
} from "@/lib/qualifications/inventory";
import { disconnectPrismaClient, exitAfterPrismaScript, prisma } from "@/lib/prisma";

function parseArgs(argv: string[]) {
  let json = false;
  let outputPath: string | null = null;
  let failOnMismatch = false;

  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg === "--fail-on-mismatch") failOnMismatch = true;
    else if (arg.startsWith("--output=")) outputPath = arg.slice("--output=".length);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: tsx scripts/audit-qualification-data.ts [options]

Read-only audit of qualification/subject structure and FK consistency.
Does not modify the database.

Options:
  --json              Print full JSON report to stdout
  --output=<path>     Write JSON report to file
  --fail-on-mismatch  Exit code 1 when FK mismatches are found
  --help              Show this help
`);
      process.exit(0);
    }
  }

  return { json, outputPath, failOnMismatch };
}

async function main() {
  const { json, outputPath, failOnMismatch } = parseArgs(process.argv.slice(2));
  const report = await runQualificationInventory(prisma);

  if (outputPath) {
    const absolutePath = resolve(outputPath);
    writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Wrote report to ${absolutePath}`);
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatQualificationInventoryReport(report));
  }

  if (failOnMismatch && report.totals.fkMismatchCount > 0) {
    await exitAfterPrismaScript(prisma, 1);
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    await exitAfterPrismaScript(prisma, 1);
  })
  .finally(async () => {
    await disconnectPrismaClient(prisma);
  });
