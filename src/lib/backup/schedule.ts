import type { BackupFrequency } from "@/generated/prisma/client";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ScheduleSettingsLike {
  enabled: boolean;
  frequency: BackupFrequency;
  backupTime: string;
}

/**
 * IANA timezone for interpreting BackupSetting.backupTime.
 * Default Asia/Shanghai for this deployment; override with BACKUP_SCHEDULE_TIMEZONE.
 */
export function getBackupScheduleTimezone(): string {
  return process.env.BACKUP_SCHEDULE_TIMEZONE?.trim() || "Asia/Shanghai";
}

function partsInTimeZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const map = Object.fromEntries(
    fmt.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: map.weekday ?? "Mon", // Mon, Tue, ...
  };
}

/** Convert a wall-clock date/time in `timeZone` to a UTC Date. */
function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const p = partsInTimeZone(new Date(guess), timeZone);
    const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
    const diff = wanted - asIfUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

function addDaysUtcGuess(
  year: number,
  month: number,
  day: number,
  deltaDays: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Start of the current schedule period (at backupTime) in UTC.
 * Weekly = Monday; Monthly = 1st of month.
 */
export function getCurrentPeriodStart(
  now: Date,
  frequency: BackupFrequency,
  backupTime: string,
  timeZone: string = getBackupScheduleTimezone(),
): Date {
  const match = TIME_RE.exec(backupTime.trim());
  if (!match) {
    throw new Error(`Invalid backupTime: ${backupTime}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const local = partsInTimeZone(now, timeZone);

  let year = local.year;
  let month = local.month;
  let day = local.day;

  if (frequency === "WEEKLY") {
    const iso = WEEKDAY_TO_ISO[local.weekday] ?? 1;
    const deltaToMonday = 1 - iso; // Mon=1 → 0; Sun=7 → -6
    ({ year, month, day } = addDaysUtcGuess(year, month, day, deltaToMonday));
  } else if (frequency === "MONTHLY") {
    day = 1;
  }

  let periodStart = zonedLocalToUtc(year, month, day, hour, minute, timeZone);

  // If we have not reached today's/this period's backupTime yet, use previous period.
  if (now.getTime() < periodStart.getTime()) {
    if (frequency === "DAILY") {
      ({ year, month, day } = addDaysUtcGuess(year, month, day, -1));
      periodStart = zonedLocalToUtc(year, month, day, hour, minute, timeZone);
    } else if (frequency === "WEEKLY") {
      ({ year, month, day } = addDaysUtcGuess(year, month, day, -7));
      periodStart = zonedLocalToUtc(year, month, day, hour, minute, timeZone);
    } else {
      // previous month, day 1
      const prev = addDaysUtcGuess(year, month, 1, -1);
      periodStart = zonedLocalToUtc(prev.year, prev.month, 1, hour, minute, timeZone);
    }
  }

  return periodStart;
}

export function evaluateScheduledBackupDue(input: {
  settings: ScheduleSettingsLike;
  lastScheduledSuccessAt: Date | null;
  now?: Date;
  timeZone?: string;
}): { due: boolean; reason: string; periodStart: Date | null } {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone ?? getBackupScheduleTimezone();

  if (!input.settings.enabled) {
    return {
      due: false,
      reason: "Scheduled backup is disabled in settings.",
      periodStart: null,
    };
  }

  if (!TIME_RE.test(input.settings.backupTime.trim())) {
    return {
      due: false,
      reason: `Invalid backup time: ${input.settings.backupTime}`,
      periodStart: null,
    };
  }

  const periodStart = getCurrentPeriodStart(
    now,
    input.settings.frequency,
    input.settings.backupTime,
    timeZone,
  );

  if (now.getTime() < periodStart.getTime()) {
    return {
      due: false,
      reason: `Not yet due (next window starts ${periodStart.toISOString()}).`,
      periodStart,
    };
  }

  if (
    input.lastScheduledSuccessAt &&
    input.lastScheduledSuccessAt.getTime() >= periodStart.getTime()
  ) {
    return {
      due: false,
      reason: "Already completed a scheduled backup for this period.",
      periodStart,
    };
  }

  return {
    due: true,
    reason: `Due for ${input.settings.frequency} backup since ${periodStart.toISOString()}.`,
    periodStart,
  };
}
