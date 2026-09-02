import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyLevelNormalize,
  formatLevelNormalizeResult,
  planLevelNormalize,
} from "@/lib/qualifications/normalize-levels";
import { formatLevelNormalizePlan } from "@/lib/qualifications/normalize-level";
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
      console.log(`Usage: tsx scripts/normalize-qualification-levels.ts [options]

Normalize qualification level labels (e.g. "A-Level" → "A Level") and merge
duplicates on the same exam board. Default is dry-run.

Options:
  --dry-run           Preview only (default)
  --apply             Write changes
  --json              Print JSON
  --output=<path>     Write JSON to file
  --help              Show help
`);
      process.exit(0);
    }
  }

  return { apply, json, outputPath };
}

async function main() {
  const { apply, json, outputPath } = parseArgs(process.argv.slice(2));

  if (!apply) {
    const plan = await planLevelNormalize(prisma);
    const payload = { mode: "dry-run" as const, plan };

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
      console.log(formatLevelNormalizePlan(plan));
    }

    if (plan.collisions.length > 0) {
      await exitAfterPrismaScript(prisma, 1);
    }
    return;
  }

  console.log("Mode: APPLY — normalizing qualification levels…");
  const result = await applyLevelNormalize(prisma);

  if (outputPath) {
    const absolutePath = resolve(outputPath);
    writeFileSync(absolutePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`Wrote result to ${absolutePath}`);
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatLevelNormalizeResult(result));
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
