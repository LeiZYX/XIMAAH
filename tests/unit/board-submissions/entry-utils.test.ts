import { describe, expect, it } from "vitest";
import {
  amendmentUnitCode,
  formatBoardEntryLabel,
  normalizeBoardEntrySlot,
  resolveBoardEntryCodes,
} from "@/lib/board-submissions/entry-utils";

describe("resolveBoardEntryCodes", () => {
  it("uses subject code for unit and paper suffix for option", () => {
    expect(
      resolveBoardEntryCodes({
        qualificationCode: "WMA11",
        subjectCode: "WMA11",
        paperCode: "WMA11/01",
      }),
    ).toEqual({
      specification: "WMA11",
      specOption: "01",
    });
  });

  it("defaults option to A for standalone unit codes", () => {
    expect(
      resolveBoardEntryCodes({
        qualificationCode: "WMA11",
        subjectCode: "WMA11",
        paperCode: "WMA11",
      }),
    ).toEqual({
      specification: "WMA11",
      specOption: "A",
    });
  });
});

describe("normalizeBoardEntrySlot", () => {
  it("repairs legacy snapshots that stored the full paper code in specOption", () => {
    expect(
      normalizeBoardEntrySlot({
        specification: "WMA11",
        specOption: "WMA11/01",
      }),
    ).toEqual({
      specification: "WMA11",
      specOption: "01",
    });
  });
});

describe("formatBoardEntryLabel", () => {
  it("shows specification only when option is the default A", () => {
    expect(
      formatBoardEntryLabel({
        specification: "WMA11",
        specOption: "A",
      }),
    ).toBe("WMA11");
  });

  it("shows specification and option separately", () => {
    expect(
      formatBoardEntryLabel({
        specification: "WMA11",
        specOption: "01",
      }),
    ).toBe("WMA11 · 01");
  });
});

describe("amendmentUnitCode", () => {
  it("uses the specification unit code for remove rows", () => {
    expect(
      amendmentUnitCode({
        specification: "WMA11",
        specOption: "01",
      }),
    ).toBe("WMA11");
  });
});
