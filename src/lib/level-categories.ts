export type LevelCategory = "IGCSE" | "AS_LEVEL" | "A_LEVEL";

export const LEVEL_CATEGORY_OPTIONS: { value: LevelCategory; label: string }[] = [
  { value: "IGCSE", label: "IGCSE" },
  { value: "AS_LEVEL", label: "AS Level" },
  { value: "A_LEVEL", label: "A Level" },
];

export const LEVEL_CATEGORY_COLORS: Record<
  LevelCategory,
  { bg: string; border: string; label: string }
> = {
  IGCSE: { bg: "#059669", border: "#047857", label: "IGCSE" },
  AS_LEVEL: { bg: "#d97706", border: "#b45309", label: "AS Level" },
  A_LEVEL: { bg: "#4f46e5", border: "#4338ca", label: "A Level" },
};

export const OTHER_SESSION_COLORS = {
  bg: "#64748b",
  border: "#475569",
  label: "Other",
};

export const LEVEL_CATEGORY_LEGEND = [
  ...LEVEL_CATEGORY_OPTIONS.map((option) => ({
    label: option.label,
    color: LEVEL_CATEGORY_COLORS[option.value].bg,
  })),
  { label: OTHER_SESSION_COLORS.label, color: OTHER_SESSION_COLORS.bg },
];

const LEVELS_BY_CATEGORY: Record<LevelCategory, string[]> = {
  IGCSE: ["IGCSE", "International GCSE"],
  AS_LEVEL: ["AS Level", "AS"],
  A_LEVEL: [
    "A-Level",
    "A Level",
    "International A Level",
    "International Advanced Level",
  ],
};

const GCE_AS_TITLE = /advanced subsidiary|\bas level\b|\(as\)/i;
const GCE_A_TITLE = /advanced level|international advanced level|\ba level\b|\(a2\)/i;
const IAL_UNIT_TITLE = /unit\s*(\d+)/i;

function internationalAdvancedLevelCategory(
  paperTitle: string | undefined,
  category: LevelCategory,
): boolean | null {
  if (!paperTitle) return null;

  const unitMatch = paperTitle.match(IAL_UNIT_TITLE);
  if (!unitMatch) return null;

  const unit = Number(unitMatch[1]);
  if (category === "AS_LEVEL") return unit <= 2;
  if (category === "A_LEVEL") return unit >= 3;
  return false;
}

export function isLevelCategory(value: string): value is LevelCategory {
  return value === "IGCSE" || value === "AS_LEVEL" || value === "A_LEVEL";
}

export function qualificationMatchesLevelCategory(
  level: string,
  category: LevelCategory,
  paperTitle?: string,
): boolean {
  if (level === "International Advanced Level") {
    const unitCategory = internationalAdvancedLevelCategory(paperTitle, category);
    if (unitCategory !== null) return unitCategory;
  }

  if (level === "GCE") {
    if (!paperTitle) return false;
    if (category === "AS_LEVEL") return GCE_AS_TITLE.test(paperTitle);
    if (category === "A_LEVEL") return GCE_A_TITLE.test(paperTitle);
    return false;
  }

  return LEVELS_BY_CATEGORY[category].includes(level);
}

export function resolveLevelCategory(
  level: string,
  paperTitle?: string,
): LevelCategory | null {
  for (const category of LEVEL_CATEGORY_OPTIONS) {
    if (qualificationMatchesLevelCategory(level, category.value, paperTitle)) {
      return category.value;
    }
  }
  return null;
}

export function sessionColorsForLevel(
  level: string,
  paperTitle?: string,
): { bg: string; border: string; levelCategory: LevelCategory | null } {
  const levelCategory = resolveLevelCategory(level, paperTitle);
  if (!levelCategory) {
    return { ...OTHER_SESSION_COLORS, levelCategory: null };
  }
  const colors = LEVEL_CATEGORY_COLORS[levelCategory];
  return { bg: colors.bg, border: colors.border, levelCategory };
}

export function qualificationLevelsForCategory(category: LevelCategory): string[] {
  const levels = [...LEVELS_BY_CATEGORY[category]];
  if (category === "AS_LEVEL" || category === "A_LEVEL") {
    levels.push("GCE");
    if (category === "AS_LEVEL" && !levels.includes("International Advanced Level")) {
      levels.push("International Advanced Level");
    }
  }
  return levels;
}

export function parseLevelCategories(values: string[]): LevelCategory[] {
  return values.filter(isLevelCategory);
}

export function qualificationLevelsForCategories(categories: LevelCategory[]): string[] {
  const levels = new Set<string>();
  for (const category of categories) {
    for (const level of qualificationLevelsForCategory(category)) {
      levels.add(level);
    }
  }
  return [...levels];
}

export function matchesAnyLevelCategory(
  level: string,
  categories: LevelCategory[],
  paperTitle?: string,
): boolean {
  if (categories.length === 0) return true;
  return categories.some((category) =>
    qualificationMatchesLevelCategory(level, category, paperTitle),
  );
}

export function summarizeEventMonths(events: { start: string }[]): string | null {
  if (events.length === 0) return null;

  const monthCounts = new Map<string, number>();
  for (const event of events) {
    const date = new Date(event.start);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  const formatter = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });
  return [...monthCounts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([monthKey, count]) => {
      const [year, month] = monthKey.split("-").map(Number);
      return `${formatter.format(new Date(year, month - 1, 1))} (${count})`;
    })
    .join(", ");
}

export function peakEventMonth(events: { start: string }[]): string | null {
  if (events.length === 0) return null;

  const monthCounts = new Map<string, number>();
  for (const event of events) {
    const key = event.start.slice(0, 7);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  const [monthKey] = [...monthCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  return `${monthKey}-01`;
}
