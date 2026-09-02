import { describe, expect, it } from "vitest";
import { cashInFeeLookupCandidates } from "@/lib/fees/cash-in-fee";

describe("cashInFeeLookupCandidates", () => {
  it("orders scopes from narrow to wide when subject is provided", () => {
    const candidates = cashInFeeLookupCandidates({
      examBoardId: "board-1",
      examSeriesId: "series-1",
      qualificationId: "qual-1",
      subjectId: "subject-1",
    });

    expect(candidates.map((item) => item.matchLevel)).toEqual([
      "BOARD_SERIES_SUBJECT",
      "BOARD_SERIES",
      "BOARD_SUBJECT",
      "BOARD",
    ]);

    expect(candidates[0]).toMatchObject({
      examSeriesId: "series-1",
      qualificationId: "qual-1",
      subjectId: "subject-1",
      serviceType: "CASH_IN",
    });
    expect(candidates[1]).toMatchObject({
      examSeriesId: "series-1",
      qualificationId: null,
      subjectId: null,
    });
    expect(candidates[2]).toMatchObject({
      examSeriesId: null,
      subjectId: "subject-1",
    });
    expect(candidates[3]).toMatchObject({
      examSeriesId: null,
      subjectId: null,
    });
  });

  it("only uses series and board scopes when subject is omitted", () => {
    const candidates = cashInFeeLookupCandidates({
      examBoardId: "board-1",
      examSeriesId: "series-1",
    });

    expect(candidates.map((item) => item.matchLevel)).toEqual(["BOARD_SERIES", "BOARD"]);
  });
});
