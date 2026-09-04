import { describe, expect, it } from "vitest";
import {
  conflictsForWindow,
  findOpenWindowSeriesConflicts,
} from "@/lib/registrations/open-window-series-conflicts";

const board = { id: "board-edexcel", name: "Pearson Edexcel", code: "EDEXCEL" };
const seriesOct = { id: "series-oct", name: "October", year: 2026 };
const seriesSummer = { id: "series-summer", name: "Summer", year: 2026 };

describe("findOpenWindowSeriesConflicts", () => {
  it("returns empty when only one Active window covers a series", () => {
    const conflicts = findOpenWindowSeriesConflicts([
      {
        id: "w1",
        title: "Autumn Edexcel",
        academicYear: "2026/27",
        status: "OPEN",
        examBoardId: board.id,
        examSeriesId: seriesOct.id,
        examBoard: board,
        examSeries: seriesOct,
        includedExamSessions: [
          {
            examSeriesId: seriesOct.id,
            name: seriesOct.name,
            year: seriesOct.year,
            examBoard: board,
          },
        ],
      },
      {
        id: "w2",
        title: "Draft other",
        academicYear: "2026/27",
        status: "DRAFT",
        examBoardId: board.id,
        examSeriesId: seriesOct.id,
        examBoard: board,
        examSeries: seriesOct,
        includedExamSessions: [
          {
            examSeriesId: seriesOct.id,
            name: seriesOct.name,
            year: seriesOct.year,
            examBoard: board,
          },
        ],
      },
    ]);

    expect(conflicts).toEqual([]);
  });

  it("flags multiple Active windows covering the same board + series", () => {
    const conflicts = findOpenWindowSeriesConflicts([
      {
        id: "w1",
        title: "2026 秋季 Edexcel",
        academicYear: "2025/26",
        status: "OPEN",
        examBoardId: board.id,
        examSeriesId: seriesOct.id,
        examBoard: board,
        examSeries: seriesOct,
        includedExamSessions: [
          {
            examSeriesId: seriesOct.id,
            name: seriesOct.name,
            year: seriesOct.year,
            examBoard: board,
          },
        ],
      },
      {
        id: "w2",
        title: "Oct 2026 EDEXCEL",
        academicYear: "2026/27",
        status: "OPEN",
        examBoardId: board.id,
        examSeriesId: seriesOct.id,
        examBoard: board,
        examSeries: seriesOct,
        includedExamSessions: [
          {
            examSeriesId: seriesOct.id,
            name: seriesOct.name,
            year: seriesOct.year,
            examBoard: board,
          },
        ],
      },
      {
        id: "w3",
        title: "Summer only",
        academicYear: "2026/27",
        status: "OPEN",
        examBoardId: board.id,
        examSeriesId: seriesSummer.id,
        examBoard: board,
        examSeries: seriesSummer,
        includedExamSessions: [
          {
            examSeriesId: seriesSummer.id,
            name: seriesSummer.name,
            year: seriesSummer.year,
            examBoard: board,
          },
        ],
      },
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      examBoardId: board.id,
      examSeriesId: seriesOct.id,
      examSeriesLabel: "October 2026",
    });
    expect(conflicts[0]!.windows.map((w) => w.id).sort()).toEqual(["w1", "w2"]);
  });

  it("uses includedSeries when includedExamSessions is absent", () => {
    const conflicts = findOpenWindowSeriesConflicts([
      {
        id: "w1",
        title: "A",
        academicYear: "2026/27",
        status: "OPEN",
        examBoardId: board.id,
        examSeriesId: seriesOct.id,
        examBoard: board,
        includedSeries: [
          {
            examSeriesId: seriesOct.id,
            examSeries: {
              name: seriesOct.name,
              year: seriesOct.year,
              examBoardId: board.id,
              examBoard: board,
            },
          },
        ],
      },
      {
        id: "w2",
        title: "B",
        academicYear: "2026/27",
        status: "OPEN",
        examBoardId: board.id,
        examSeriesId: seriesOct.id,
        examBoard: board,
        includedSeries: [
          {
            examSeriesId: seriesOct.id,
            examSeries: {
              name: seriesOct.name,
              year: seriesOct.year,
              examBoardId: board.id,
              examBoard: board,
            },
          },
        ],
      },
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.windows).toHaveLength(2);
  });
});

describe("conflictsForWindow", () => {
  it("filters conflicts that involve the given window", () => {
    const conflicts = findOpenWindowSeriesConflicts([
      {
        id: "w1",
        title: "A",
        academicYear: "2026/27",
        status: "OPEN",
        examBoardId: board.id,
        examSeriesId: seriesOct.id,
        examBoard: board,
        examSeries: seriesOct,
      },
      {
        id: "w2",
        title: "B",
        academicYear: "2026/27",
        status: "OPEN",
        examBoardId: board.id,
        examSeriesId: seriesOct.id,
        examBoard: board,
        examSeries: seriesOct,
      },
    ]);

    expect(conflictsForWindow(conflicts, "w1")).toHaveLength(1);
    expect(conflictsForWindow(conflicts, "w3")).toHaveLength(0);
  });
});
