import { describe, expect, it } from "vitest";
import { indexWindowsByBoardSeries } from "@/lib/registrations/included-series";

const boardId = "board-1";
const seriesId = "series-oct";

describe("indexWindowsByBoardSeries", () => {
  it("prefers an OPEN window over a CLOSED window for the same board+series", () => {
    const closed = {
      id: "closed",
      status: "CLOSED",
      examBoardId: boardId,
      examSeriesId: seriesId,
      includedSeries: [
        {
          examSeriesId: seriesId,
          examSeries: { examBoardId: boardId },
        },
      ],
    };
    const open = {
      id: "open",
      status: "OPEN",
      examBoardId: boardId,
      examSeriesId: seriesId,
      includedSeries: [
        {
          examSeriesId: seriesId,
          examSeries: { examBoardId: boardId },
        },
      ],
    };

    const closedFirst = indexWindowsByBoardSeries([closed, open]);
    expect(closedFirst.get(`${boardId}:${seriesId}`)?.id).toBe("open");

    const openFirst = indexWindowsByBoardSeries([open, closed]);
    expect(openFirst.get(`${boardId}:${seriesId}`)?.id).toBe("open");
  });
});
