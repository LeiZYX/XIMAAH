"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminStatus } from "@/components/admin/useAdminList";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface ExamBoard {
  id: string;
  name: string;
  code: string;
  calendarSubjectFilterEnabled: boolean;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  qualification: {
    id: string;
    name: string;
    level: string;
    examBoardId: string;
  };
}

interface SelectionResponse {
  examBoards: ExamBoard[];
  subjects: Subject[];
  selections: Record<string, string[]>;
}

export default function CalendarSubjectsPage() {
  const [examBoards, setExamBoards] = useState<ExamBoard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [activeBoardId, setActiveBoardId] = useState("");
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [draftSubjectIds, setDraftSubjectIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/calendar/subject-selections");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load calendar subject settings");
      }
      setExamBoards(data.examBoards);
      setSubjects(data.subjects);
      setSelections(data.selections);
      setActiveBoardId((current) => current || data.examBoards[0]?.id || "");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeBoard = examBoards.find((board) => board.id === activeBoardId);

  useEffect(() => {
    if (!activeBoardId) return;
    setDraftEnabled(activeBoard?.calendarSubjectFilterEnabled ?? false);
    setDraftSubjectIds(new Set(selections[activeBoardId] ?? []));
    setSaveMessage(null);
  }, [activeBoardId, activeBoard?.calendarSubjectFilterEnabled, selections]);

  const boardSubjects = useMemo(
    () =>
      subjects.filter((subject) => subject.qualification.examBoardId === activeBoardId),
    [subjects, activeBoardId],
  );

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return boardSubjects;

    return boardSubjects.filter(
      (subject) =>
        subject.name.toLowerCase().includes(query) ||
        subject.code.toLowerCase().includes(query) ||
        subject.qualification.level.toLowerCase().includes(query),
    );
  }, [boardSubjects, search]);

  const groupedSubjects = useMemo(() => {
    const groups = new Map<string, Subject[]>();
    for (const subject of filteredSubjects) {
      const key = `${subject.qualification.level} — ${subject.qualification.name}`;
      const existing = groups.get(key);
      if (existing) {
        existing.push(subject);
      } else {
        groups.set(key, [subject]);
      }
    }
    return [...groups.entries()];
  }, [filteredSubjects]);

  function toggleSubject(subjectId: string) {
    setDraftSubjectIds((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
    setSaveMessage(null);
  }

  function selectVisible() {
    setDraftSubjectIds(new Set(filteredSubjects.map((subject) => subject.id)));
    setDraftEnabled(true);
    setSaveMessage(null);
  }

  function clearVisible() {
    setDraftSubjectIds((current) => {
      const next = new Set(current);
      for (const subject of filteredSubjects) next.delete(subject.id);
      return next;
    });
    setSaveMessage(null);
  }

  function setGroupSelection(subjectIds: string[], selected: boolean) {
    setDraftSubjectIds((current) => {
      const next = new Set(current);
      for (const subjectId of subjectIds) {
        if (selected) next.add(subjectId);
        else next.delete(subjectId);
      }
      return next;
    });
    if (selected) setDraftEnabled(true);
    setSaveMessage(null);
  }

  function groupSelectionState(items: Subject[]) {
    const selectedCount = items.filter((item) => draftSubjectIds.has(item.id)).length;
    return {
      allSelected: selectedCount === items.length && items.length > 0,
      someSelected: selectedCount > 0 && selectedCount < items.length,
      selectedCount,
    };
  }

  async function handleSave() {
    if (!activeBoardId) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/calendar/subject-selections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examBoardId: activeBoardId,
          enabled: draftEnabled,
          subjectIds: [...draftSubjectIds],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save");

      setSelections((current) => ({
        ...current,
        [activeBoardId]: data.subjectIds,
      }));
      setExamBoards((current) =>
        current.map((board) =>
          board.id === activeBoardId
            ? { ...board, calendarSubjectFilterEnabled: data.enabled }
            : board,
        ),
      );
      setSaveMessage("Saved. Calendar will only show selected subjects for this exam board.");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Calendar Subjects"
        description="Choose which subjects appear on the calendar for each exam board."
      />

      <Card className="mb-6">
        <p className="text-sm text-slate-600">
          By default, all subjects are shown. Enable filtering for an exam board and tick the
          subjects you need.{" "}
          <Link href="/calendar" className="font-medium text-indigo-600 hover:text-indigo-700">
            Open calendar
          </Link>
        </p>
      </Card>

      <AdminStatus
        loading={loading}
        error={loadError}
        empty={!loading && !examBoards.length}
        entityName="exam boards"
      />

      {!loading && !loadError && examBoards.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <Card className="h-fit">
            <p className="mb-3 text-sm font-medium text-slate-700">Exam boards</p>
            <div className="space-y-1">
              {examBoards.map((board) => {
                const selectedCount = selections[board.id]?.length ?? 0;
                const active = board.id === activeBoardId;

                return (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => setActiveBoardId(board.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-indigo-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="font-medium">{board.code}</span>
                    <span className={`mt-0.5 block text-xs ${active ? "text-indigo-100" : "text-slate-500"}`}>
                      {board.calendarSubjectFilterEnabled
                        ? `${selectedCount} selected`
                        : "All subjects"}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {activeBoard?.code} — {activeBoard?.name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {draftEnabled
                    ? `${draftSubjectIds.size} subject${draftSubjectIds.size === 1 ? "" : "s"} selected`
                    : "Showing all subjects on the calendar"}
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draftEnabled}
                  onChange={(event) => {
                    setDraftEnabled(event.target.checked);
                    setSaveMessage(null);
                  }}
                  className="rounded border-slate-300 text-indigo-600"
                />
                Limit calendar to selected subjects
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search subject, code, or level..."
                className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={selectVisible}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Select visible
              </button>
              <button
                type="button"
                onClick={clearVisible}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Clear visible
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>

            {saveMessage ? (
              <p
                className={`mt-4 text-sm ${
                  saveMessage.startsWith("Saved")
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {saveMessage}
              </p>
            ) : null}

            <div className={`mt-6 space-y-6 ${draftEnabled ? "" : "opacity-60"}`}>
              {groupedSubjects.length === 0 ? (
                <p className="text-sm text-slate-500">No subjects match your search.</p>
              ) : (
                groupedSubjects.map(([group, items]) => {
                  const { allSelected, someSelected, selectedCount } =
                    groupSelectionState(items);

                  return (
                  <div key={group}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-800">{group}</h3>
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(element) => {
                            if (element) element.indeterminate = someSelected;
                          }}
                          disabled={!draftEnabled}
                          onChange={(event) =>
                            setGroupSelection(
                              items.map((item) => item.id),
                              event.target.checked,
                            )
                          }
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        Select all ({selectedCount}/{items.length})
                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((subject) => (
                        <label
                          key={subject.id}
                          className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={draftSubjectIds.has(subject.id)}
                            disabled={!draftEnabled}
                            onChange={() => toggleSubject(subject.id)}
                            className="mt-0.5 rounded border-slate-300 text-indigo-600"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-900">
                              {subject.code}
                            </span>
                            <span className="block truncate text-xs text-slate-600">
                              {subject.name}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
