import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyQualificationMerge,
  formatQualificationMergeResult,
  planQualificationMerge,
} from "@/lib/qualifications/merge";
import { formatQualificationMergePlan } from "@/lib/qualifications/merge-plan";
import { runQualificationInventory } from "@/lib/qualifications/inventory";
import { disconnectPrismaClient, exitAfterPrismaScript, prisma } from "@/lib/prisma";

function parseArgs(argv: string[]) {
  let apply = false;
  let json = false;
  let outputPath: string | null = null;

  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") apply = false;
    else if (arg === "--json") json = true;
    else if (arg.startsWith("--output=")) outputPath = arg.slice("--output=".length);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: tsx scripts/merge-qualifications.ts [options]

Merge per-syllabus qualifications into one level-based qualification per
exam board + level. Subject IDs are never changed.

Default is dry-run (no writes).

Options:
  --dry-run           Preview plan only (default)
  --apply             Execute merge in a transaction (DESTRUCTIVE)
  --json              Print JSON to stdout
  --output=<path>     Write JSON plan/result to file
  --help              Show this help

Recommended sequence:
  1. Backup database
  2. npm run db:audit-qualifications -- --fail-on-mismatch
  3. npm run db:merge-qualifications -- --dry-run
  4. npm run db:merge-qualifications -- --apply
  5. npm run db:audit-qualifications
`);
      process.exit(0);
    }
  }

  return { apply, json, outputPath };
}

async function main() {
  const { apply, json, outputPath } = parseArgs(process.argv.slice(2));

  if (!apply) {
    const inventory = await runQualificationInventory(prisma);
    const plan = await planQualificationMerge(prisma);
    const payload = {
      mode: "dry-run" as const,
      inventoryTotals: inventory.totals,
      plan,
    };

    if (outputPath) {
      const absolutePath = resolve(outputPath);
      writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      console.log(`Wrote plan to ${absolutePath}`);
    }

    if (json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log("Mode: dry-run (no database writes)");
      console.log("");
      console.log(
        `Pre-check FK mismatches: ${inventory.totals.fkMismatchCount} ` +
          `(syllabus-style: ${inventory.totals.syllabusStyleQualificationCount})`,
      );
      console.log("");
      console.log(formatQualificationMergePlan(plan));
      if (inventory.totals.fkMismatchCount > 0) {
        console.log("");
        console.log("Refusing apply until FK mismatches are fixed.");
      }
      if (plan.collisions.length > 0) {
        console.log("");
        console.log("Refusing apply until subject-code collisions are resolved.");
      }
    }

    if (inventory.totals.fkMismatchCount > 0 || plan.collisions.length > 0) {
      await exitAfterPrismaScript(prisma, 1);
    }
    return;
  }

  console.log("Mode: APPLY — writing qualification merge…");
  const result = await applyQualificationMerge(prisma);

  if (outputPath) {
    const absolutePath = resolve(outputPath);
    writeFileSync(absolutePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`Wrote result to ${absolutePath}`);
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatQualificationMergeResult(result));
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
