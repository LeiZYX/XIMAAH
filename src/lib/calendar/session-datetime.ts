/** Calendar date from DB date-only values (stored as UTC midnight). */
export function examSessionCalendarDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function floatingDateTime(dateKey: string, time: string): string {
  const [hours, minutes = "0"] = time.split(":");
  return `${dateKey}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
}

/** Floating local datetime for FullCalendar — no timezone suffix. */
export function examSessionCalendarStart(date: Date, startTime?: string | null): string {
  const dateKey = examSessionCalendarDateKey(date);
  if (!startTime) return dateKey;
  return floatingDateTime(dateKey, startTime);
}

export function examSessionCalendarEnd(
  date: Date,
  startTime?: string | null,
  endTime?: string | null,
): string | undefined {
  const dateKey = examSessionCalendarDateKey(date);
  if (endTime) return floatingDateTime(dateKey, endTime);

  if (startTime) {
    const [hours, minutes = "0"] = startTime.split(":");
    const endHour = Number(hours) + 2;
    return floatingDateTime(dateKey, `${endHour}:${minutes}`);
  }

  return undefined;
}
