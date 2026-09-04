import { describe, expect, it } from "vitest";
import { formatExamSeriesDeleteBlockedMessage } from "@/lib/exam-series/delete-guard";

describe("formatExamSeriesDeleteBlockedMessage", () => {
  it("lists blocking references", () => {
    expect(
      formatExamSeriesDeleteBlockedMessage([
        { label: "exam session(s)", count: 3 },
        { label: "registration window(s)", count: 1 },
      ]),
    ).toBe(
      "Cannot delete this exam series because it is still in use: 3 exam session(s), 1 registration window(s). Remove or reassign those records first.",
    );
  });
});
