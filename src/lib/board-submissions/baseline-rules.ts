export const BULK_ENTRIES_BASELINE_LOCKED_MESSAGE =
  "An amendment baseline already exists. Mark further submissions from the Amendment tab.";

export function canCreateBulkEntriesBaseline(input: {
  hasAmendmentBaseline: boolean;
  rowsReady: boolean;
}): boolean {
  return input.rowsReady && !input.hasAmendmentBaseline;
}
