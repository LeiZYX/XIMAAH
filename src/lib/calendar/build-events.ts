import { RegistrationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ensureExpiredWindowsLocked } from "@/lib/registrations/lock";
import { buildStudentVisibleRegistrationWhere } from "@/lib/registrations/filters";
import {
  isLevelCategory,
  matchesAnyLevelCategory,
  parseLevelCategories,
  qualificationLevelsForCategories,
} from "@/lib/level-categories";
import {
  formatSessionTimeRange,
  sessionCalendarLabel,
  sessionCalendarSubjectLine,
  sessionEventAppearance,
} from "@/lib/calendar-events";
import {
  getCalendarSubjectFilterState,
  isSubjectVisibleOnCalendar,
} from "@/lib/calendar-subject-selections";
import { canStudentRegisterInWindow, describeStudentRegistrationAvailability } from "@/lib/registrations/window";
import { indexWindowsByBoardSeries } from "@/lib/registrations/included-series";
import type { RegistrationFeeStageRecord } from "@/lib/registrations/fee-stages";
import type { CalendarEvent } from "@/lib/types";

export interface CalendarQueryParams {
  examBoardIds: string[];
  qualificationId?: string;
  subjectId?: string;
  examSeriesId?: string;
  levelCategories: ReturnType<typeof parseLevelCategories>;
  showSessions: boolean;
  showKeyDates: boolean;
  studentId?: string;
  registeredOnly?: boolean;
}

function sessionEndTime(date: Date, startTime?: string | null, endTime?: string | null) {
  if (endTime) {
    const [hours, minutes] = endTime.split(":").map(Number);
    const end = new Date(date);
    end.setHours(hours, minutes, 0, 0);
    return end.toISOString();
  }

  if (startTime) {
    const [hours, minutes] = startTime.split(":").map(Number);
    const end = new Date(date);
    end.setHours(hours + 2, minutes, 0, 0);
    return end.toISOString();
  }

  return undefined;
}

function sessionStartTime(date: Date, startTime?: string | null) {
  if (!startTime) {
    return date.toISOString().split("T")[0];
  }

  const [hours, minutes] = startTime.split(":").map(Number);
  const start = new Date(date);
  start.setHours(hours, minutes, 0, 0);
  return start.toISOString();
}

export async function buildCalendarEvents(params: CalendarQueryParams): Promise<CalendarEvent[]> {
  const {
    examBoardIds,
    qualificationId,
    subjectId,
    examSeriesId,
    levelCategories,
    showSessions,
    showKeyDates,
    studentId,
    registeredOnly,
  } = params;

  const filterState = await getCalendarSubjectFilterState();
  const events: CalendarEvent[] = [];
  const now = new Date();

  if (studentId) {
    await ensureExpiredWindowsLocked();
  }

  const [openWindows, studentRegistrations] = await Promise.all([
    prisma.registrationWindow.findMany({
      where: { status: "OPEN" },
      select: {
        id: true,
        examBoardId: true,
        examSeriesId: true,
        studentRegistrationOpenAt: true,
        studentRegistrationCloseAt: true,
        registrationCloseAt: true,
        status: true,
        title: true,
        studentSelfRegistrationEnabled: true,
        feeStages: { orderBy: { sequence: "asc" } },
        includedSeries: {
          select: {
            examSeriesId: true,
            examSeries: { select: { examBoardId: true } },
          },
        },
      },
    }),
    studentId
      ? prisma.studentExamRegistration.findMany({
          where: buildStudentVisibleRegistrationWhere(studentId),
          select: { id: true, examSessionId: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const registrationBySession = new Map(
    studentRegistrations.map((row) => [row.examSessionId, row]),
  );

  const openWindowKey = (boardId: string, seriesId: string) => `${boardId}:${seriesId}`;
  const openWindowMap = new Map<string, (typeof openWindows)[number]>();

  for (const window of openWindows) {
    const eligibleForStudent = studentId
      ? canStudentRegisterInWindow(window, [], now)
      : now >= window.studentRegistrationOpenAt && now <= window.registrationCloseAt;

    if (!eligibleForStudent) continue;

    if (window.includedSeries.length > 0) {
      for (const row of window.includedSeries) {
        openWindowMap.set(
          openWindowKey(row.examSeries.examBoardId, row.examSeriesId),
          window,
        );
      }
      continue;
    }

    openWindowMap.set(openWindowKey(window.examBoardId, window.examSeriesId), window);
  }

  const allWindowsForMatch = await prisma.registrationWindow.findMany({
    where: { status: { in: ["OPEN", "DRAFT", "CLOSED"] } },
    select: {
      id: true,
      title: true,
      examBoardId: true,
      examSeriesId: true,
      studentRegistrationOpenAt: true,
      studentRegistrationCloseAt: true,
      registrationCloseAt: true,
      status: true,
      studentSelfRegistrationEnabled: true,
      feeStages: { orderBy: { sequence: "asc" } },
      includedSeries: {
        select: {
          examSeriesId: true,
          examSeries: { select: { examBoardId: true } },
        },
      },
    },
  });
  const anyWindowByBoardSeries = indexWindowsByBoardSeries(allWindowsForMatch);

  const sessionWhere = {
    ...(examSeriesId ? { examSeriesId } : {}),
    ...(examBoardIds.length > 0
      ? { examSeries: { examBoardId: { in: examBoardIds } } }
      : {}),
    ...(subjectId ? { paper: { subjectId } } : {}),
    ...(qualificationId && !subjectId
      ? { paper: { subject: { qualificationId } } }
      : {}),
    ...(levelCategories.length > 0 && !qualificationId && !subjectId
      ? {
          paper: {
            subject: {
              qualification: {
                level: { in: qualificationLevelsForCategories(levelCategories) },
              },
            },
          },
        }
      : {}),
    ...(registeredOnly && studentId
      ? { id: { in: studentRegistrations.map((row) => row.examSessionId) } }
      : {}),
  };

  if (showSessions) {
    const sessions = await prisma.examSession.findMany({
      where: sessionWhere,
      include: {
        paper: {
          select: {
            id: true,
            code: true,
            title: true,
            subject: {
              select: {
                id: true,
                name: true,
                code: true,
                qualification: {
                  select: {
                    name: true,
                    level: true,
                    examBoard: { select: { id: true, name: true, code: true } },
                  },
                },
              },
            },
          },
        },
        examSeries: { select: { id: true, name: true, year: true } },
      },
    });

    for (const session of sessions) {
      const { qualification } = session.paper.subject;

      if (
        levelCategories.length > 0 &&
        !matchesAnyLevelCategory(qualification.level, levelCategories, session.paper.title)
      ) {
        continue;
      }

      if (
        !isSubjectVisibleOnCalendar(
          filterState,
          qualification.examBoard.id,
          session.paper.subject.id,
        )
      ) {
        continue;
      }

      const examBoardCode = qualification.examBoard.code;
      const examBoardName = qualification.examBoard.name;
      const appearance = sessionEventAppearance(
        qualification.level,
        examBoardCode,
        session.paper.title,
        examBoardName,
      );

      const calendarTimeLabel = formatSessionTimeRange(session.startTime, session.endTime);
      const calendarDetailLabel = sessionCalendarSubjectLine(
        qualification.level,
        session.paper.subject.name,
        session.paper.title,
      );

      const registration = registrationBySession.get(session.id);
      const window = openWindowMap.get(
        openWindowKey(qualification.examBoard.id, session.examSeries.id),
      );
      const matchedWindow = anyWindowByBoardSeries.get(
        openWindowKey(qualification.examBoard.id, session.examSeries.id),
      );
      const availability =
        studentId && matchedWindow
          ? describeStudentRegistrationAvailability(
              matchedWindow,
              (matchedWindow.feeStages ?? []) as RegistrationFeeStageRecord[],
              now,
            )
          : null;
      const isActive = registration?.status === RegistrationStatus.ACTIVE;
      const isLocked = registration?.status === RegistrationStatus.LOCKED;

      events.push({
        id: `session-${session.id}`,
        title: `${calendarTimeLabel} ${calendarDetailLabel}`.trim(),
        start: sessionStartTime(session.date, session.startTime),
        end: sessionEndTime(session.date, session.startTime, session.endTime),
        allDay: !session.startTime,
        type: "session",
        backgroundColor: isLocked
          ? "#1d4ed8"
          : isActive
            ? "#fef3c7"
            : appearance.backgroundColor,
        borderColor: isLocked
          ? "#fbbf24"
          : isActive
            ? "#f59e0b"
            : appearance.borderColor,
        extendedProps: {
          entityId: session.id,
          entityType: "session",
          levelCategory: appearance.levelCategory,
          boardAccent: appearance.boardAccent,
          boardLabel: appearance.boardLabel,
          calendarLabel: sessionCalendarLabel(session.paper.subject.name, session.paper.code),
          calendarTimeLabel,
          calendarDetailLabel,
          paperCode: session.paper.code,
          paperTitle: session.paper.title,
          subject: session.paper.subject.name,
          subjectCode: session.paper.subject.code,
          qualification: `${qualification.level} ${qualification.name}`,
          examBoard: examBoardCode,
          examSeries: `${session.examSeries.name} (${session.examSeries.year})`,
          venue: session.venue,
          startTime: session.startTime,
          endTime: session.endTime,
          notes: session.notes,
          registrationOpen: studentId ? (availability?.open ?? false) : false,
          registrationClosedReason: availability?.open === false ? availability.reason : null,
          registrationCurrentStage: availability?.currentFeeStage ?? null,
          showStaffContactHint: availability?.showStaffContactHint ?? false,
          studentListLocked: availability?.studentListLocked ?? false,
          registrationWindowId: window?.id ?? matchedWindow?.id,
          registrationWindowTitle: window?.title ?? matchedWindow?.title,
          isRegistered: Boolean(registration),
          isActive,
          isLocked,
          isInList: isActive,
          isSubmitted: isLocked,
          registrationId: registration?.id,
          registrationStatus: registration?.status,
        },
      });
    }
  }

  if (showKeyDates && !registeredOnly) {
    const keyDateWhere = {
      ...(examSeriesId ? { examSeriesId } : {}),
      ...(examBoardIds.length > 0 ? { examBoardId: { in: examBoardIds } } : {}),
      ...(subjectId ? { subjectId } : {}),
    };

    const keyDates = await prisma.keyDate.findMany({
      where: keyDateWhere,
      include: {
        examBoard: { select: { id: true, name: true, code: true } },
        subject: {
          select: {
            id: true,
            name: true,
            qualification: { select: { name: true, level: true, examBoardId: true } },
          },
        },
        examSeries: { select: { name: true, year: true } },
      },
    });

    const typeColors: Record<string, { bg: string; border: string }> = {
      DEADLINE: { bg: "#dc2626", border: "#b91c1c" },
      RESULTS: { bg: "#16a34a", border: "#15803d" },
      REGISTRATION: { bg: "#ca8a04", border: "#a16207" },
      OTHER: { bg: "#7c3aed", border: "#6d28d9" },
    };

    for (const keyDate of keyDates) {
      if (levelCategories.length > 0 && keyDate.subject) {
        const { level } = keyDate.subject.qualification;
        if (!matchesAnyLevelCategory(level, levelCategories)) continue;
      }

      if (keyDate.subject) {
        const boardId = keyDate.examBoardId ?? keyDate.subject.qualification.examBoardId;
        if (!isSubjectVisibleOnCalendar(filterState, boardId, keyDate.subject.id)) continue;
      }

      const colors = typeColors[keyDate.type] ?? typeColors.OTHER;
      events.push({
        id: `keydate-${keyDate.id}`,
        title: keyDate.title,
        start: keyDate.date.toISOString().split("T")[0],
        allDay: true,
        type: "keydate",
        backgroundColor: colors.bg,
        borderColor: colors.border,
        extendedProps: {
          entityId: keyDate.id,
          entityType: "keydate",
          keyDateType: keyDate.type,
          description: keyDate.description,
          examBoard: keyDate.examBoard?.code,
          subject: keyDate.subject?.name,
          qualification: keyDate.subject
            ? `${keyDate.subject.qualification.level} ${keyDate.subject.qualification.name}`
            : undefined,
          examSeries: keyDate.examSeries
            ? `${keyDate.examSeries.name} (${keyDate.examSeries.year})`
            : undefined,
        },
      });
    }
  }

  return events;
}

export function parseCalendarSearchParams(searchParams: URLSearchParams): CalendarQueryParams {
  return {
    examBoardIds: searchParams.getAll("examBoardId").filter(Boolean),
    qualificationId: searchParams.get("qualificationId") || undefined,
    subjectId: searchParams.get("subjectId") || undefined,
    examSeriesId: searchParams.get("examSeriesId") || undefined,
    levelCategories: parseLevelCategories(searchParams.getAll("levelCategory")),
    showSessions: searchParams.get("showSessions") !== "false",
    showKeyDates: searchParams.get("showKeyDates") !== "false",
    registeredOnly: searchParams.get("registeredOnly") === "true",
  };
}

export { isLevelCategory };
