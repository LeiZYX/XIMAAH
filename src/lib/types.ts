export type CalendarEventType = "session" | "keydate";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  type: CalendarEventType;
  backgroundColor: string;
  borderColor: string;
  extendedProps: Record<string, unknown>;
}

export interface ApiError {
  error: string;
}
