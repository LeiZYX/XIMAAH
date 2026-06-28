"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { CalendarEvent } from "@/lib/types";
import {
  LEVEL_CATEGORY_COLORS,
  LEVEL_CATEGORY_LEGEND,
  LEVEL_CATEGORY_OPTIONS,
  peakEventMonth,
  qualificationMatchesLevelCategory,
  summarizeEventMonths,
  type LevelCategory,
} from "@/lib/level-categories";
import { examBoardAccent } from "@/lib/exam-board-colors";
import { Card } from "@/components/ui/Card";
import {
  sessionEventContent,
  sessionEventDidMount,
} from "@/components/calendar/sessionEventContent";
import { CALENDAR_EVENT_BODY_HEIGHT_PX } from "@/lib/calendar-event-layout";
import { filterCalendarEvents } from "@/lib/calendar-search";

interface ExamBoardOption {
  id: string;
  name: string;
  code: string;
}

interface QualificationOption {
  id: string;
  name: string;
  level: string;
  examBoardId: string;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string;
  qualificationId: string;
}

interface ExamSeriesOption {
  id: string;
  name: string;
  year: number;
  examBoardId: string;
}

interface CalendarFilters {
  levelCategories: LevelCategory[];
  examBoardIds: string[];
  qualificationId: string;
  subjectId: string;
  examSeriesId: string;
  showSessions: boolean;
  showKeyDates: boolean;
}

const KEY_DATE_LEGEND = [
  { label: "Deadline", color: "#dc2626" },
  { label: "Results", color: "#16a34a" },
  { label: "Registration", color: "#ca8a04" },
  { label: "Other key date", color: "#7c3aed" },
];

function eventDateKey(start: string): string {
  return start.slice(0, 10);
}

function MultiSelectPills<T extends string>({
  label,
  options,
  selected,
  onToggle,
  onClear,
  getColor,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  onClear: () => void;
  getColor?: (value: T) => string | undefined;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700">{label}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClear}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            selected.length === 0
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          All
        </button>
        {options.map((option) => {
          const active = selected.includes(option.value);
          const accent = getColor?.(option.value);

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              style={
                active && accent
                  ? { backgroundColor: accent, color: "#fff" }
                  : !active && accent
                    ? { boxShadow: `inset 0 0 0 2px ${accent}` }
                    : undefined
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value?: unknown }) {
  if (!value) return null;

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-slate-700">{String(value)}</p>
    </div>
  );
}

export function CalendarView() {
  const [filters, setFilters] = useState<CalendarFilters>({
    levelCategories: [],
    examBoardIds: [],
    qualificationId: "",
    subjectId: "",
    examSeriesId: "",
    showSessions: true,
    showKeyDates: true,
  });
  const [examBoards, setExamBoards] = useState<ExamBoardOption[]>([]);
  const [qualifications, setQualifications] = useState<QualificationOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [examSeries, setExamSeries] = useState<ExamSeriesOption[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const searchParams = useSearchParams();
  const [examViewMode, setExamViewMode] = useState<"all" | "my">(
    searchParams.get("view") === "my" ? "my" : "all",
  );
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [registrationActionLoading, setRegistrationActionLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const hasLoadedEventsRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const calendarRef = useRef<FullCalendar>(null);
  const lastNavigatedLevels = useRef<string>("");

  const selectedDateKey = selectedEvent ? eventDateKey(selectedEvent.start) : null;

  useEffect(() => {
    fetch("/api/exam-boards")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load exam boards");
        return response.json();
      })
      .then(setExamBoards)
      .catch(() => setExamBoards([]));
  }, []);

  useEffect(() => {
    fetch("/api/qualifications")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load qualifications");
        return response.json();
      })
      .then((data: QualificationOption[]) => setQualifications(data))
      .catch(() => setQualifications([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.qualificationId) params.set("qualificationId", filters.qualificationId);

    fetch(`/api/subjects?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load subjects");
        return response.json();
      })
      .then((data: SubjectOption[]) => setSubjects(data))
      .catch(() => setSubjects([]));
  }, [filters.qualificationId]);

  useEffect(() => {
    fetch("/api/exam-series")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load exam series");
        return response.json();
      })
      .then((data: ExamSeriesOption[]) => setExamSeries(data))
      .catch(() => setExamSeries([]));
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const user = data?.user ?? null;
        setCurrentUser(user ? { id: user.id, role: user.role } : null);
      })
      .catch(() => setCurrentUser(null));
  }, []);

  const loadEvents = useCallback(async () => {
    const isFirstLoad = !hasLoadedEventsRef.current;
    if (isFirstLoad) {
      setInitialLoading(true);
    }
    setError(null);

    const params = new URLSearchParams();
    for (const boardId of filters.examBoardIds) params.append("examBoardId", boardId);
    if (filters.qualificationId) params.set("qualificationId", filters.qualificationId);
    if (filters.subjectId) params.set("subjectId", filters.subjectId);
    if (filters.examSeriesId) params.set("examSeriesId", filters.examSeriesId);
    for (const category of filters.levelCategories) params.append("levelCategory", category);
    params.set("showSessions", String(filters.showSessions));
    params.set("showKeyDates", String(filters.showKeyDates));
    if (examViewMode === "my" && currentUser?.role === "STUDENT") {
      params.set("registeredOnly", "true");
    }

    const endpoint =
      examViewMode === "my" && currentUser?.role === "STUDENT"
        ? "/api/calendar/my"
        : "/api/calendar";

    try {
      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Failed to load calendar events",
        );
      }
      const data = await response.json();
      const nextEvents = Array.isArray(data) ? data : [];
      setEvents(nextEvents);
      setSelectedEvent((current) => {
        if (!current) return null;
        return nextEvents.find((item: CalendarEvent) => item.id === current.id) ?? null;
      });
    } catch (loadError) {
      setEvents([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load events. Ensure MySQL is running and data has been seeded.",
      );
    } finally {
      hasLoadedEventsRef.current = true;
      setInitialLoading(false);
    }
  }, [filters, examViewMode, currentUser]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (initialLoading || events.length === 0) return;

    const levelKey = filters.levelCategories.join(",");
    if (filters.levelCategories.length === 0 || lastNavigatedLevels.current === levelKey) {
      return;
    }

    const targetMonth = peakEventMonth(events);
    if (!targetMonth) return;

    const timeoutId = window.setTimeout(() => {
      calendarRef.current?.getApi()?.gotoDate(targetMonth);
      lastNavigatedLevels.current = levelKey;
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [events, filters.levelCategories, initialLoading]);

  useEffect(() => {
    if (filters.levelCategories.length === 0) {
      lastNavigatedLevels.current = "";
    }
  }, [filters.levelCategories]);

  function toggleLevelCategory(category: LevelCategory) {
    setFilters((current) => ({
      ...current,
      levelCategories: current.levelCategories.includes(category)
        ? current.levelCategories.filter((item) => item !== category)
        : [...current.levelCategories, category],
      qualificationId: "",
      subjectId: "",
    }));
  }

  function toggleExamBoard(boardId: string) {
    setFilters((current) => ({
      ...current,
      examBoardIds: current.examBoardIds.includes(boardId)
        ? current.examBoardIds.filter((item) => item !== boardId)
        : [...current.examBoardIds, boardId],
      qualificationId: "",
      subjectId: "",
      examSeriesId: "",
    }));
  }

  const filteredQualifications = qualifications.filter((qual) => {
    if (filters.examBoardIds.length > 0 && !filters.examBoardIds.includes(qual.examBoardId)) {
      return false;
    }
    if (filters.levelCategories.length === 0) return true;
    return filters.levelCategories.some((category) =>
      qualificationMatchesLevelCategory(qual.level, category),
    );
  });

  const allowedQualificationIds = new Set(filteredQualifications.map((qual) => qual.id));
  const filteredSubjects = subjects.filter((subject) =>
    filters.qualificationId
      ? subject.qualificationId === filters.qualificationId
      : allowedQualificationIds.has(subject.qualificationId),
  );

  const filteredSeries = examSeries.filter((series) =>
    filters.examBoardIds.length === 0
      ? true
      : filters.examBoardIds.includes(series.examBoardId),
  );

  const visibleEvents = useMemo(
    () => filterCalendarEvents(events, searchQuery),
    [events, searchQuery],
  );

  useEffect(() => {
    if (!selectedEvent) return;
    if (!visibleEvents.some((item) => item.id === selectedEvent.id)) {
      setSelectedEvent(null);
    }
  }, [visibleEvents, selectedEvent]);

  const searchActive = searchQuery.trim().length > 0;
  const isStudent = currentUser?.role === "STUDENT";
  const selectedProps = selectedEvent?.extendedProps ?? {};
  const canRegister =
    isStudent &&
    selectedEvent?.type === "session" &&
    selectedProps.registrationOpen &&
    !selectedProps.isRegistered;
  const canRemoveFromList =
    isStudent &&
    selectedEvent?.type === "session" &&
    selectedProps.isActive &&
    selectedProps.registrationOpen;

  async function handleAddToList() {
    if (!selectedEvent || selectedEvent.type !== "session") return;
    const examSessionId = String(selectedProps.entityId ?? "");
    if (!examSessionId) return;

    setRegistrationActionLoading(true);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examSessionId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not add to list");
      }
      await loadEvents();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not add to list");
    } finally {
      setRegistrationActionLoading(false);
    }
  }

  async function handleRemoveFromList() {
    const registrationId = String(selectedProps.registrationId ?? "");
    if (!registrationId) return;

    setRegistrationActionLoading(true);
    try {
      const response = await fetch(`/api/registrations/${registrationId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not remove from list");
      }
      await loadEvents();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not remove from list");
    } finally {
      setRegistrationActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Only subjects selected per exam board are shown.{" "}
          <Link
            href="/admin/calendar-subjects"
            className="font-medium text-indigo-600 hover:text-indigo-700"
          >
            Manage calendar subjects
          </Link>
        </p>
        {isStudent ? (
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setExamViewMode("all")}
              className={`rounded-md px-3 py-1.5 font-medium ${
                examViewMode === "all"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Exams
            </button>
            <button
              type="button"
              onClick={() => setExamViewMode("my")}
              className={`rounded-md px-3 py-1.5 font-medium ${
                examViewMode === "my"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              My Exams
            </button>
          </div>
        ) : null}
      </div>

      <Card>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Search</span>
            <div className="relative">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Subject, paper code, exam board, series…"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              {searchActive ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-2 my-auto rounded px-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {searchActive ? (
              <p className="mt-1 text-xs text-slate-500">
                Matching {visibleEvents.length} of {events.length} event
                {events.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </label>

          <MultiSelectPills
            label="Qualification level"
            options={LEVEL_CATEGORY_OPTIONS}
            selected={filters.levelCategories}
            onToggle={toggleLevelCategory}
            onClear={() =>
              setFilters((current) => ({
                ...current,
                levelCategories: [],
                qualificationId: "",
                subjectId: "",
              }))
            }
            getColor={(value) => LEVEL_CATEGORY_COLORS[value].bg}
          />

          <MultiSelectPills
            label="Exam board"
            options={examBoards.map((board) => ({
              value: board.id,
              label: board.code,
            }))}
            selected={filters.examBoardIds}
            onToggle={toggleExamBoard}
            onClear={() =>
              setFilters((current) => ({
                ...current,
                examBoardIds: [],
                qualificationId: "",
                subjectId: "",
                examSeriesId: "",
              }))
            }
            getColor={(boardId) => {
              const board = examBoards.find((item) => item.id === boardId);
              return board ? examBoardAccent(board.code).accent : undefined;
            }}
          />

          {!initialLoading && visibleEvents.length > 0 ? (
            <p className="text-xs text-slate-500">
              {searchActive
                ? `${visibleEvents.length} matching event${visibleEvents.length === 1 ? "" : "s"} · ${summarizeEventMonths(visibleEvents) ?? "No dates"}`
                : filters.levelCategories.length > 0 || filters.examBoardIds.length > 0
                  ? `${visibleEvents.length} event${visibleEvents.length === 1 ? "" : "s"} · ${summarizeEventMonths(visibleEvents) ?? "No dates"}`
                  : `${visibleEvents.length} total events · use filters above to narrow by level, board, or series`}
            </p>
          ) : null}
          {!initialLoading && searchActive && visibleEvents.length === 0 ? (
            <p className="text-xs text-amber-700">No events match your search.</p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FilterSelect
            label="Qualification"
            value={filters.qualificationId}
            onChange={(qualificationId) =>
              setFilters((current) => ({
                ...current,
                qualificationId,
                subjectId: "",
              }))
            }
            placeholder="All qualifications"
            options={filteredQualifications.map((qual) => ({
              value: qual.id,
              label: `${qual.level} — ${qual.name}`,
            }))}
          />

          <FilterSelect
            label="Subject"
            value={filters.subjectId}
            onChange={(subjectId) =>
              setFilters((current) => ({ ...current, subjectId }))
            }
            placeholder="All subjects"
            options={filteredSubjects.map((subject) => ({
              value: subject.id,
              label: `${subject.code} — ${subject.name}`,
            }))}
          />

          <FilterSelect
            label="Series"
            value={filters.examSeriesId}
            onChange={(examSeriesId) =>
              setFilters((current) => ({ ...current, examSeriesId }))
            }
            placeholder="All series"
            options={filteredSeries.map((series) => ({
              value: series.id,
              label: `${series.name} (${series.year})`,
            }))}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.showSessions}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  showSessions: event.target.checked,
                }))
              }
              className="rounded border-slate-300 text-indigo-600"
            />
            Exam sessions
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.showKeyDates}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  showKeyDates: event.target.checked,
                }))
              }
              className="rounded border-slate-300 text-indigo-600"
            />
            Key dates
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            {filters.showSessions
              ? LEVEL_CATEGORY_LEGEND.map((item) => (
                  <span
                    key={item.label}
                    className="flex items-center gap-1.5 text-xs text-slate-600"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                ))
              : null}
            {filters.showKeyDates
              ? KEY_DATE_LEGEND.map((item) => (
                  <span
                    key={item.label}
                    className="flex items-center gap-1.5 text-xs text-slate-600"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                ))
              : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-4">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {initialLoading ? (
            <div className="flex h-[700px] items-center justify-center text-sm text-slate-500">
              Loading calendar...
            </div>
          ) : (
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,listMonth",
              }}
              height={700}
              eventMinHeight={CALENDAR_EVENT_BODY_HEIGHT_PX}
              dayMaxEvents={2}
              moreLinkClick="popover"
              events={visibleEvents}
              dayCellClassNames={(arg) => {
                if (!selectedDateKey) return [];
                const year = arg.date.getFullYear();
                const month = String(arg.date.getMonth() + 1).padStart(2, "0");
                const day = String(arg.date.getDate()).padStart(2, "0");
                return `${year}-${month}-${day}` === selectedDateKey ? ["fc-day-selected"] : [];
              }}
              eventClassNames={(arg) => {
                const classes: string[] = [];
                if (arg.event.id === selectedEvent?.id) classes.push("fc-event-selected");
                if (arg.event.extendedProps.isLocked) classes.push("fc-event-submitted");
                if (arg.event.extendedProps.isActive) classes.push("fc-event-in-list");
                return classes;
              }}
              eventContent={sessionEventContent}
              eventDidMount={sessionEventDidMount}
              eventClick={(info) => {
                const event = visibleEvents.find((item) => item.id === info.event.id);
                if (event) setSelectedEvent(event);
              }}
              eventDisplay="block"
              displayEventTime={false}
              nowIndicator
              eventTimeFormat={{
                hour: "2-digit",
                minute: "2-digit",
                meridiem: false,
              }}
            />
          )}
          {!initialLoading && !error ? (
            <p className="mt-3 text-xs text-slate-500">
              Showing {visibleEvents.length} event{visibleEvents.length === 1 ? "" : "s"}
              {searchActive ? ` (filtered from ${events.length})` : ""}
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Event details</h2>
          {selectedEvent ? (
            <div className="space-y-3 text-sm">
              <DetailRow label="Title" value={selectedEvent.title} />
              <DetailRow
                label="Type"
                value={
                  selectedEvent.type === "session"
                    ? "Exam session"
                    : `Key date (${String(selectedEvent.extendedProps.keyDateType ?? "OTHER").toLowerCase()})`
                }
              />
              <DetailRow label="Exam board" value={selectedEvent.extendedProps.examBoard} />
              <DetailRow
                label="Qualification"
                value={selectedEvent.extendedProps.qualification}
              />
              <DetailRow label="Subject" value={selectedEvent.extendedProps.subject} />
              <DetailRow label="Series" value={selectedEvent.extendedProps.examSeries} />
              <DetailRow label="Paper" value={selectedEvent.extendedProps.paperCode} />
              <DetailRow label="Venue" value={selectedEvent.extendedProps.venue} />
              {selectedEvent.extendedProps.startTime ? (
                <DetailRow
                  label="Time"
                  value={`${selectedEvent.extendedProps.startTime}${selectedEvent.extendedProps.endTime ? ` – ${selectedEvent.extendedProps.endTime}` : ""}`}
                />
              ) : null}
              <DetailRow label="Description" value={selectedEvent.extendedProps.description} />
              <DetailRow label="Notes" value={selectedEvent.extendedProps.notes} />
              {selectedEvent.type === "session" && isStudent ? (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  {selectedProps.isLocked ? (
                    <p className="font-medium text-indigo-700">Locked after deadline</p>
                  ) : selectedProps.isActive ? (
                    <p className="font-medium text-amber-700">Selected</p>
                  ) : selectedProps.registrationOpen ? (
                    <p className="text-emerald-700">
                      Registration open
                      {selectedProps.registrationWindowTitle
                        ? ` — ${String(selectedProps.registrationWindowTitle)}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-slate-500">Registration is not open for this exam.</p>
                  )}
                  {canRegister ? (
                    <button
                      type="button"
                      disabled={registrationActionLoading}
                      onClick={handleAddToList}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Add to list
                    </button>
                  ) : null}
                  {canRemoveFromList ? (
                    <button
                      type="button"
                      disabled={registrationActionLoading}
                      onClick={handleRemoveFromList}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Remove from list
                    </button>
                  ) : null}
                  <Link
                    href="/student/registrations"
                    className="block text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    My Exam Registrations
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Click an exam session or key date to view details.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
