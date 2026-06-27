import type { CalendarEvent } from "@/lib/types";

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function calendarEventSearchText(event: CalendarEvent): string {
  const props = event.extendedProps;

  return [
    event.title,
    props.subject,
    props.subjectCode,
    props.paperCode,
    props.paperTitle,
    props.examBoard,
    props.boardLabel,
    props.qualification,
    props.examSeries,
    props.calendarDetailLabel,
    props.calendarTimeLabel,
    props.calendarLabel,
    props.description,
    props.notes,
    props.venue,
    props.keyDateType,
  ]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

export function matchesCalendarSearch(event: CalendarEvent, query: string): boolean {
  const normalized = normalizeSearchText(query);
  if (!normalized) return true;

  const haystack = calendarEventSearchText(event);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  return tokens.every((token) => haystack.includes(token));
}

export function filterCalendarEvents(
  events: CalendarEvent[],
  query: string,
): CalendarEvent[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return events;
  return events.filter((event) => matchesCalendarSearch(event, normalized));
}
