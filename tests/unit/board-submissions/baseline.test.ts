import { describe, expect, it } from "vitest";
import { canCreateBulkEntriesBaseline } from "@/lib/board-submissions/baseline";

describe("canCreateBulkEntriesBaseline", () => {
  it("allows submit when rows are ready and no amendment baseline exists", () => {
    expect(
      canCreateBulkEntriesBaseline({
        hasAmendmentBaseline: false,
        rowsReady: true,
      }),
    ).toBe(true);
  });

  it("blocks submit once any amendment baseline exists", () => {
    expect(
      canCreateBulkEntriesBaseline({
        hasAmendmentBaseline: true,
        rowsReady: true,
      }),
    ).toBe(false);
  });

  it("blocks submit when rows are not ready", () => {
    expect(
      canCreateBulkEntriesBaseline({
        hasAmendmentBaseline: false,
        rowsReady: false,
      }),
    ).toBe(false);
  });
});
