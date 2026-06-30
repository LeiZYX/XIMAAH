import type { LevelCategory } from "@/lib/level-categories";
import { getCalendarBoardLabel } from "@/lib/calendar/board-label";
import { examBoardAccent } from "@/lib/exam-board-colors";
import { resolveLevelCategory, sessionColorsForLevel } from "@/lib/level-categories";

export interface SessionEventAppearance {
  backgroundColor: string;
  borderColor: string;
  boardAccent: string;
  boardLabel: string;
  levelCategory: LevelCategory | null;
}

export function sessionEventAppearance(
  level: string,
  examBoardCode: string,
  paperTitle?: string,
  examBoardName?: string,
): SessionEventAppearance {
  const levelColors = sessionColorsForLevel(level, paperTitle);
  const board = examBoardAccent(examBoardCode);

  return {
    backgroundColor: levelColors.bg,
    borderColor: board.accent,
    boardAccent: board.accent,
    boardLabel: getCalendarBoardLabel({ code: examBoardCode, name: examBoardName }),
    levelCategory: levelColors.levelCategory,
  };
}

export function levelCategoryAbbrev(category: LevelCategory | null): string {
  if (category === "IGCSE") return "IG";
  if (category === "AS_LEVEL") return "AS";
  if (category === "A_LEVEL") return "AL";
  return "";
}

function compactClockTime(time: string): string {
  const [hours, minutes = "00"] = time.split(":");
  return `${Number(hours)}:${minutes.padStart(2, "0")}`;
}

export function formatSessionTimeRange(
  startTime?: string | null,
  endTime?: string | null,
): string {
  if (!startTime) return "";
  const start = compactClockTime(startTime);
  if (endTime) return `${start}-${compactClockTime(endTime)}`;
  return start;
}

export function sessionCalendarDetailLabel(
  level: string,
  subjectName: string,
  paperCode: string,
  paperTitle?: string,
): string {
  const levelAbbrev = levelCategoryAbbrev(resolveLevelCategory(level, paperTitle));
  return [levelAbbrev, subjectName, paperCode].filter(Boolean).join(" ");
}

export function sessionCalendarSubjectLine(
  level: string,
  subjectName: string,
  paperTitle?: string,
): string {
  const levelAbbrev = levelCategoryAbbrev(resolveLevelCategory(level, paperTitle));
  return [levelAbbrev, subjectName].filter(Boolean).join(" ");
}

export function sessionCalendarLabel(subjectName: string, paperCode: string): string {
  return `${subjectName} — ${paperCode}`;
}
