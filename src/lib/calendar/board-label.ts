export type CalendarBoardInput =
  | string
  | {
      code?: string | null;
      name?: string | null;
    };

const BOARD_NAME_TO_CODE: Record<string, string> = {
  "edexcel (pearson)": "EDEXCEL",
  edexcel: "EDEXCEL",
  "cambridge international": "CIE",
  cambridge: "CIE",
  "oxford aqa": "AQA",
  aqa: "AQA",
};

const KNOWN_BOARD_CODES = new Set(["EDEXCEL", "CIE", "AQA"]);

function normalizeBoardCode(value: string): string | null {
  const upper = value.trim().toUpperCase();
  return KNOWN_BOARD_CODES.has(upper) ? upper : null;
}

/**
 * Compact exam board label for Calendar UI only.
 * Maps official names and codes to EDEXCEL, CIE, or AQA.
 */
export function getCalendarBoardLabel(board: CalendarBoardInput): string {
  if (typeof board === "string") {
    const trimmed = board.trim();
    if (!trimmed) return "?";

    const byName = BOARD_NAME_TO_CODE[trimmed.toLowerCase()];
    if (byName) return byName;

    const byCode = normalizeBoardCode(trimmed);
    if (byCode) return byCode;

    return trimmed.toUpperCase();
  }

  const code = board.code?.trim();
  if (code) {
    const byCode = normalizeBoardCode(code);
    if (byCode) return byCode;
  }

  const name = board.name?.trim();
  if (name) {
    const byName = BOARD_NAME_TO_CODE[name.toLowerCase()];
    if (byName) return byName;
  }

  if (code) return code.toUpperCase();
  if (name) return name.toUpperCase();
  return "?";
}
