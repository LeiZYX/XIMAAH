import type { BulkEntrySlot } from "@/lib/board-submissions/bulk-entries/types";

export function entryKey(entry: BulkEntrySlot): string {
  return `${entry.specification}::${entry.specOption}`;
}

export function entrySet(entries: BulkEntrySlot[]): Set<string> {
  return new Set(entries.map(entryKey));
}

export function diffEntryLists(baseline: BulkEntrySlot[], current: BulkEntrySlot[]) {
  const baselineKeys = entrySet(baseline);
  const currentKeys = entrySet(current);

  const adds = current.filter((entry) => !baselineKeys.has(entryKey(entry)));
  const removes = baseline.filter((entry) => !currentKeys.has(entryKey(entry)));

  return { adds, removes };
}

export function amendmentUnitCode(entry: BulkEntrySlot | undefined): string {
  if (!entry) return "";
  return entry.specOption?.trim() || entry.specification?.trim() || "";
}
