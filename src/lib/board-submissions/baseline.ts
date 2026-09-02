import type { BulkEntriesSnapshotRow } from "@/lib/board-submissions/bulk-entries/types";

export function parseBaselineSnapshot(value: unknown): BulkEntriesSnapshotRow[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const candidateId = "candidateId" in row ? String(row.candidateId) : "";
    const entries = "entries" in row && Array.isArray(row.entries) ? row.entries : [];
    if (!candidateId) return [];

    return [
      {
        candidateId,
        entries: entries.flatMap((entry: unknown) => {
          if (!entry || typeof entry !== "object") return [];
          const specification =
            "specification" in entry ? String(entry.specification ?? "").trim() : "";
          const specOption = "specOption" in entry ? String(entry.specOption ?? "").trim() : "";
          if (!specification || !specOption) return [];
          return [{ specification, specOption }];
        }),
      },
    ];
  });
}
