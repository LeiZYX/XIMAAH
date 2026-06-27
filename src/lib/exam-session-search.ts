export const EXAM_SESSION_PREVIEW_LIMIT = 6;
export const EXAM_SESSION_SEARCH_LIMIT = 25;

export interface ExamSessionSearchable {
  id: string;
  date: string | Date;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  paper: {
    code: string;
    title?: string | null;
    subject: {
      name: string;
      qualification?: {
        name?: string | null;
        examBoard?: { name?: string | null; code?: string | null } | null;
      } | null;
    };
  };
}

function normalizeToken(value: string): string {
  return value.replace(/[/\-_.\s]/g, "").toLowerCase();
}

function sessionDateLabel(date: string | Date): string {
  if (typeof date === "string") return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function examSessionSearchText(session: ExamSessionSearchable): string {
  const parts = [
    session.paper.subject.name,
    session.paper.subject.qualification?.name,
    session.paper.subject.qualification?.examBoard?.name,
    session.paper.subject.qualification?.examBoard?.code,
    session.paper.code,
    normalizeToken(session.paper.code),
    session.paper.title,
    sessionDateLabel(session.date),
    session.startTime,
    session.endTime,
    session.venue,
  ];

  return parts
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

export function matchesExamSessionSearch(
  session: ExamSessionSearchable,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = examSessionSearchText(session);
  const compactHaystack = normalizeToken(haystack);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  return tokens.every((token) => {
    if (haystack.includes(token)) return true;
    const compactToken = normalizeToken(token);
    return compactToken.length > 0 && compactHaystack.includes(compactToken);
  });
}

export function filterExamSessions<T extends ExamSessionSearchable>(
  sessions: T[],
  query: string,
  limit = EXAM_SESSION_SEARCH_LIMIT,
): T[] {
  const normalized = query.trim();
  const filtered = normalized
    ? sessions.filter((session) => matchesExamSessionSearch(session, normalized))
    : sessions;

  return filtered.slice(0, limit);
}

export function limitExamSessions<T extends ExamSessionSearchable>(
  sessions: T[],
  query: string,
): { items: T[]; limit: number; truncated: boolean } {
  const normalized = query.trim();
  const limit = normalized ? EXAM_SESSION_SEARCH_LIMIT : EXAM_SESSION_PREVIEW_LIMIT;
  const filtered = normalized
    ? sessions.filter((session) => matchesExamSessionSearch(session, normalized))
    : sessions;

  return {
    items: filtered.slice(0, limit),
    limit,
    truncated: filtered.length > limit,
  };
}

export function formatExamSessionOptionLabel(session: ExamSessionSearchable): string {
  const date = sessionDateLabel(session.date);
  const time = session.startTime ? ` ${session.startTime}` : "";
  const title = session.paper.title ? ` — ${session.paper.title}` : "";
  return `${session.paper.subject.name} · ${session.paper.code}${title} · ${date}${time}`;
}
