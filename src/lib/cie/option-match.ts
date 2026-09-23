/**
 * Match Hub paper codes to CIE Direct component codes.
 * Paper codes may be "12", "0452/12", "0452_12", etc.
 */
export function normalizeComponentCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return "";
  const slash = trimmed.split(/[/_-]/).filter(Boolean);
  if (slash.length >= 2) {
    return slash[slash.length - 1]!.replace(/\D/g, "") || slash[slash.length - 1]!;
  }
  const digits = trimmed.replace(/\D/g, "");
  return digits || trimmed;
}

export function componentCodesEqual(a: string, b: string): boolean {
  return normalizeComponentCode(a) === normalizeComponentCode(b);
}

export function sortComponentCodes(codes: string[]): string[] {
  return [...codes]
    .map((c) => normalizeComponentCode(c))
    .filter(Boolean)
    .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
}

export function componentSetsEqual(a: string[], b: string[]): boolean {
  const left = sortComponentCodes(a);
  const right = sortComponentCodes(b);
  if (left.length !== right.length) return false;
  return left.every((code, i) => code === right[i]);
}

export type CieOptionDef = {
  optionCode: string;
  componentCodes: string[];
  syllabusCode: string;
};

export type OptionMatchResult =
  | { status: "exact"; option: CieOptionDef }
  | {
      status: "partial" | "extra" | "none";
      closest: CieOptionDef | null;
      missing: string[];
      extra: string[];
    };

export function matchOptionForComponents(
  options: CieOptionDef[],
  selectedComponentCodes: string[],
): OptionMatchResult {
  const selected = sortComponentCodes(selectedComponentCodes);
  if (selected.length === 0) {
    return { status: "none", closest: null, missing: [], extra: [] };
  }

  for (const option of options) {
    if (componentSetsEqual(option.componentCodes, selected)) {
      return { status: "exact", option };
    }
  }

  let best: {
    option: CieOptionDef;
    missing: string[];
    extra: string[];
    score: number;
  } | null = null;

  for (const option of options) {
    const required = sortComponentCodes(option.componentCodes);
    const requiredSet = new Set(required);
    const selectedSet = new Set(selected);
    const missing = required.filter((c) => !selectedSet.has(c));
    const extra = selected.filter((c) => !requiredSet.has(c));
    const overlap = required.length - missing.length;
    const score = overlap * 10 - missing.length - extra.length * 2;
    if (!best || score > best.score) {
      best = { option, missing, extra, score };
    }
  }

  if (!best) {
    return { status: "none", closest: null, missing: [], extra: selected };
  }

  if (best.extra.length > 0 && best.missing.length === 0) {
    return {
      status: "extra",
      closest: best.option,
      missing: best.missing,
      extra: best.extra,
    };
  }
  if (best.missing.length > 0) {
    return {
      status: "partial",
      closest: best.option,
      missing: best.missing,
      extra: best.extra,
    };
  }
  return {
    status: "none",
    closest: best.option,
    missing: best.missing,
    extra: best.extra,
  };
}

export function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
