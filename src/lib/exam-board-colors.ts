export const EXAM_BOARD_ACCENTS: Record<string, { accent: string; label: string }> = {
  AQA: { accent: "#be123c", label: "AQA" },
  CIE: { accent: "#0284c7", label: "CIE" },
  EDEXCEL: { accent: "#312e81", label: "Edexcel" },
};

export const EXAM_BOARD_LEGEND = Object.entries(EXAM_BOARD_ACCENTS).map(([code, value]) => ({
  code,
  label: value.label,
  color: value.accent,
}));

export function examBoardAccent(code: string, name?: string) {
  const normalized = code.trim().toUpperCase();
  const mapped = EXAM_BOARD_ACCENTS[normalized];
  if (mapped) return mapped;
  return {
    accent: "#475569",
    label: name?.trim() || code || "Other",
  };
}

export function examBoardCalendarLabel(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (normalized === "AQA") return "AQA";
  if (normalized === "CIE") return "CIE";
  if (normalized === "EDEXCEL") return "Edexcel";
  return normalized || "?";
}

export function examBoardInitial(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (normalized === "AQA") return "A";
  if (normalized === "CIE") return "C";
  if (normalized === "EDEXCEL") return "E";
  return normalized.charAt(0) || "?";
}
