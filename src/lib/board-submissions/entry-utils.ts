import type { BulkEntrySlot } from "@/lib/board-submissions/bulk-entries/types";

export function resolveBoardEntryCodes(input: {
  qualificationCode: string | null | undefined;
  subjectCode: string;
  paperCode: string;
}): BulkEntrySlot | null {
  const specification = input.qualificationCode?.trim() || input.subjectCode.trim();
  if (!specification) return null;

  const paperCode = input.paperCode.trim();
  if (!paperCode) {
    return { specification, specOption: "A" };
  }

  const slashIndex = paperCode.indexOf("/");
  if (slashIndex > 0) {
    const specOption = paperCode.slice(slashIndex + 1).trim();
    if (!specOption) return null;
    return { specification, specOption };
  }

  if (paperCode.toUpperCase() === specification.toUpperCase()) {
    return { specification, specOption: "A" };
  }

  return { specification, specOption: paperCode };
}

export function normalizeBoardEntrySlot(entry: BulkEntrySlot): BulkEntrySlot {
  const specification = entry.specification.trim();
  const specOption = entry.specOption.trim();
  if (!specification || !specOption) return entry;

  if (specOption.startsWith(`${specification}/`)) {
    return {
      specification,
      specOption: specOption.slice(specification.length + 1).trim(),
    };
  }

  const slashIndex = specOption.indexOf("/");
  if (slashIndex > 0 && !specification) {
    return {
      specification: specOption.slice(0, slashIndex).trim(),
      specOption: specOption.slice(slashIndex + 1).trim(),
    };
  }

  return { specification, specOption };
}

export function entryKey(entry: BulkEntrySlot): string {
  const normalized = normalizeBoardEntrySlot(entry);
  return `${normalized.specification}::${normalized.specOption}`;
}

export function entrySet(entries: BulkEntrySlot[]): Set<string> {
  return new Set(entries.map((entry) => entryKey(normalizeBoardEntrySlot(entry))));
}

export function diffEntryLists(baseline: BulkEntrySlot[], current: BulkEntrySlot[]) {
  const baselineKeys = entrySet(baseline);
  const currentKeys = entrySet(current);

  const adds = current
    .map(normalizeBoardEntrySlot)
    .filter((entry) => !baselineKeys.has(entryKey(entry)));
  const removes = baseline
    .map(normalizeBoardEntrySlot)
    .filter((entry) => !currentKeys.has(entryKey(entry)));

  return { adds, removes };
}

export function formatBoardEntryLabel(entry: BulkEntrySlot): string {
  const normalized = normalizeBoardEntrySlot(entry);
  if (!normalized.specOption || normalized.specOption === "A") {
    return normalized.specification;
  }
  return `${normalized.specification} · ${normalized.specOption}`;
}

export function amendmentUnitCode(entry: BulkEntrySlot | undefined): string {
  if (!entry) return "";
  const normalized = normalizeBoardEntrySlot(entry);
  return normalized.specification || normalized.specOption || "";
}
