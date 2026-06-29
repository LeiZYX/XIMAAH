import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SNIPPET = `export const dynamic = "force-dynamic";\nexport const revalidate = 0;\n\n`;
const SNIPPET_REGEX =
  /export const dynamic = "force-dynamic";\nexport const revalidate = 0;\n\n/g;

function walk(dir, matches = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, matches);
      continue;
    }
    if (
      entry.name === "route.ts" ||
      entry.name === "page.tsx" ||
      entry.name === "layout.tsx"
    ) {
      matches.push(fullPath);
    }
  }
  return matches;
}

function findInsertIndex(lines) {
  let index = 0;

  if (/^["']use client["'];?\s*$/.test(lines[0]?.trim() ?? "")) {
    index = 1;
  }

  let cursor = index;
  while (cursor < lines.length) {
    const trimmed = lines[cursor].trim();

    if (trimmed === "") {
      cursor += 1;
      continue;
    }

    if (trimmed.startsWith("import ") || trimmed.startsWith("import type")) {
      while (cursor < lines.length) {
        const line = lines[cursor];
        cursor += 1;
        if (line.includes(";")) {
          break;
        }
      }
      continue;
    }

    return cursor;
  }

  return cursor;
}

function configureFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const isClientPage =
    filePath.endsWith("page.tsx") && content.trimStart().startsWith('"use client"');

  if (isClientPage) {
    return false;
  }

  const cleaned = content.replace(SNIPPET_REGEX, "");
  const lines = cleaned.split("\n");
  const insertAt = findInsertIndex(lines);
  lines.splice(insertAt, 0, ...SNIPPET.trimEnd().split("\n"), "");
  const next = lines.join("\n");

  if (next === content) {
    return false;
  }

  fs.writeFileSync(filePath, next);
  return true;
}

const targets = walk(path.join(ROOT, "src/app"));
let updated = 0;

for (const filePath of targets) {
  if (configureFile(filePath)) {
    updated += 1;
  }
}

console.log(`Configured ${updated} files.`);
