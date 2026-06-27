const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";

export interface AqaTimetableRow {
  date: string;
  qualificationLevel: string;
  syllabusCode: string;
  paperCode: string;
  subject: string;
  title: string;
  startTime: string;
  durationMinutes: number | null;
}

export interface AqaTimetableMeta {
  seriesName: string;
  year: number;
}

const SUBJECT_HEADER = /^(.+?)\s+(A-level|AS)\s+(\d{4})\s*$/i;
const DATE_AMPM = new RegExp(
  `(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4})\\s*(am|pm)\\s*$`,
  "i",
);
const DURATION = /(\d+h(?:\s*\d+m)?|\d+m)/i;
const SERIES = /May\/June\s+(\d{4})/i;

function parseDuration(raw: string): number | null {
  const normalized = raw.replace(/\s+/g, "");
  const hoursMinutes = normalized.match(/(\d+)h(?:(\d+)m)?/i);
  if (hoursMinutes) {
    return Number(hoursMinutes[1]) * 60 + Number(hoursMinutes[2] ?? 0);
  }

  const minutesOnly = normalized.match(/(\d+)m/i);
  if (minutesOnly) {
    return Number(minutesOnly[1]);
  }

  return null;
}

function parseDate(raw: string): string | null {
  const match = raw.match(new RegExp(`(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})`, "i"));
  if (!match) return null;

  const day = Number(match[1]);
  const monthName = match[2].toLowerCase();
  const year = Number(match[3]);
  const monthIndex = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].indexOf(monthName);

  if (monthIndex < 0) return null;

  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function mapLevel(level: string): string {
  if (level.toUpperCase() === "AS") return "AS Level";
  return "A Level";
}

function sessionStartTime(slot: string): string {
  return slot.toLowerCase() === "pm" ? "13:30" : "09:00";
}

function extractPaperComponent(rest: string): string | null {
  const match = rest.match(
    /^(\d+[A-Z]?|[A-Z])(?=Paper|Unit|Non-exam|Study|Externally|Portfolio|[A-Z][a-z])/,
  );
  return match?.[1] ?? null;
}

function parseExamLine(
  line: string,
  subject: string,
  qualificationLevel: string,
  syllabusCode: string,
): AqaTimetableRow | null {
  const timing = line.match(DATE_AMPM);
  if (!timing) return null;

  const prefix = `${syllabusCode}/`;
  const prefixIndex = line.indexOf(prefix);
  if (prefixIndex < 0) return null;

  const beforeTiming = line.slice(0, timing.index).trim();
  const rest = beforeTiming.slice(prefixIndex + prefix.length);
  const component = extractPaperComponent(rest);
  if (!component) return null;

  const titlePart = rest.slice(component.length);
  const durationMatch = titlePart.match(DURATION);
  if (!durationMatch || durationMatch.index === undefined) return null;

  const title = titlePart.slice(0, durationMatch.index).trim();
  const date = parseDate(timing[1]);
  if (!date || !title) return null;

  return {
    date,
    qualificationLevel,
    syllabusCode,
    paperCode: `${syllabusCode}/${component}`,
    subject,
    title,
    startTime: sessionStartTime(timing[2]),
    durationMinutes: parseDuration(durationMatch[1]),
  };
}

function parseContinuationLine(
  line: string,
  pending: { paperCode: string; subject: string; qualificationLevel: string; syllabusCode: string; title: string },
): AqaTimetableRow | null {
  const timing = line.match(DATE_AMPM);
  if (!timing) return null;

  const durationMatch = line.match(new RegExp(`^\\s*${DURATION.source}`, "i"));
  if (!durationMatch) return null;

  const date = parseDate(timing[1]);
  if (!date) return null;

  return {
    date,
    qualificationLevel: pending.qualificationLevel,
    syllabusCode: pending.syllabusCode,
    paperCode: pending.paperCode,
    subject: pending.subject,
    title: pending.title,
    startTime: sessionStartTime(timing[2]),
    durationMinutes: parseDuration(durationMatch[1]),
  };
}

function parsePartialPaperLine(
  line: string,
  subject: string,
  qualificationLevel: string,
  syllabusCode: string,
):
  | { paperCode: string; subject: string; qualificationLevel: string; syllabusCode: string; title: string }
  | null {
  const prefix = `${syllabusCode}/`;
  const normalized = line.replace(/^(Either|or)\s*/i, "");
  const prefixIndex = normalized.indexOf(prefix);
  if (prefixIndex < 0) return null;

  const rest = normalized.slice(prefixIndex + prefix.length);
  const component = extractPaperComponent(rest);
  if (!component) return null;

  const title = rest.slice(component.length).trim();
  if (!title) return null;

  return {
    paperCode: `${syllabusCode}/${component}`,
    subject,
    qualificationLevel,
    syllabusCode,
    title,
  };
}

export function parseAqaTimetableText(text: string): {
  rows: AqaTimetableRow[];
  meta: AqaTimetableMeta;
} {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const seriesMatch = text.match(SERIES);
  const meta: AqaTimetableMeta = {
    seriesName: "Summer 2026",
    year: seriesMatch ? Number(seriesMatch[1]) : 2026,
  };

  const rows: AqaTimetableRow[] = [];
  let subject = "";
  let qualificationLevel = "";
  let syllabusCode = "";
  let pending: {
    paperCode: string;
    subject: string;
    qualificationLevel: string;
    syllabusCode: string;
    title: string;
  } | null = null;

  for (const line of lines) {
    const subjectMatch = line.match(SUBJECT_HEADER);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      qualificationLevel = mapLevel(subjectMatch[2]);
      syllabusCode = subjectMatch[3];
      pending = null;
      continue;
    }

    if (!subject || !syllabusCode) continue;

    const examRow = parseExamLine(line, subject, qualificationLevel, syllabusCode);
    if (examRow) {
      rows.push(examRow);
      pending = null;
      continue;
    }

    if (pending) {
      const continued = parseContinuationLine(line, pending);
      if (continued) {
        rows.push(continued);
        pending = null;
        continue;
      }
    }

    pending = parsePartialPaperLine(line, subject, qualificationLevel, syllabusCode);
  }

  return { rows, meta };
}

type PdfParseFn = (buffer: Buffer) => Promise<{ text: string }>;

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Import the library entry directly — the package root runs a debug read on load.
  const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = pdfParseModule.default as PdfParseFn;
  const parsed = await pdfParse(buffer);
  return parsed.text;
}

export async function parseAqaTimetablePdf(buffer: Buffer): Promise<{
  rows: AqaTimetableRow[];
  meta: AqaTimetableMeta;
}> {
  const text = await extractPdfText(buffer);
  return parseAqaTimetableText(text);
}
