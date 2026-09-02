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

interface Paper {
  id: string;
  code: string;
  title: string;
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
  papers: Paper[];
}

interface QualificationGroup {
  key: string;
  qualificationId: string;
  level: string;
  name: string;
  subjects: Subject[];
}

interface SelectionResponse {
  examBoards: ExamBoard[];
  subjects: Subject[];
  selections: Record<string, string[]>;
  legacySubjectSelections?: Record<string, string[]>;
}

function expandLegacySubjectSelections(
  subjects: Subject[],
  subjectIds: string[],
): Set<string> {
  const subjectIdSet = new Set(subjectIds);
  const paperIds = new Set<string>();
  for (const subject of subjects) {
    if (!subjectIdSet.has(subject.id)) continue;
    for (const paper of subject.papers) {
      paperIds.add(paper.id);
    }
  }
  return paperIds;
}

function selectionState(selectedCount: number, totalCount: number) {
  return {
    allSelected: selectedCount === totalCount && totalCount > 0,
    someSelected: selectedCount > 0 && selectedCount < totalCount,
    selectedCount,
  };
}

export default function CalendarSubjectsPage() {
  const [examBoards, setExamBoards] = useState<ExamBoard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [activeBoardId, setActiveBoardId] = useState("");
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [draftPaperIds, setDraftPaperIds] = useState<Set<string>>(new Set());
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
      const data = (await response.json()) as SelectionResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to load calendar subject settings");
      }

      const resolvedSelections = Object.fromEntries(
        data.examBoards.map((board) => {
          const paperIds = data.selections[board.id] ?? [];
          if (paperIds.length > 0) {
            return [board.id, paperIds];
          }

          const legacySubjectIds = data.legacySubjectSelections?.[board.id] ?? [];
          if (legacySubjectIds.length > 0) {
            return [
              board.id,
              [...expandLegacySubjectSelections(data.subjects, legacySubjectIds)],
            ];
          }

          return [board.id, []];
        }),
      );

      setExamBoards(data.examBoards);
      setSubjects(data.subjects);
      setSelections(resolvedSelections);
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
    setDraftPaperIds(new Set(selections[activeBoardId] ?? []));
    setSaveMessage(null);
  }, [activeBoardId, activeBoard?.calendarSubjectFilterEnabled, selections]);

  const boardSubjects = useMemo(
    () =>
      subjects.filter((subject) => subject.qualification.examBoardId === activeBoardId),
    [subjects, activeBoardId],
  );

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const groups = new Map<string, QualificationGroup>();

    for (const subject of boardSubjects) {
      const qualKey = subject.qualification.id;
      const matchesSubject =
        !query ||
        subject.name.toLowerCase().includes(query) ||
        subject.code.toLowerCase().includes(query) ||
        subject.qualification.level.toLowerCase().includes(query) ||
        subject.qualification.name.toLowerCase().includes(query);

      const matchingPapers = subject.papers.filter(
        (paper) =>
          !query ||
          matchesSubject ||
          paper.code.toLowerCase().includes(query) ||
          paper.title.toLowerCase().includes(query),
      );

      if (matchingPapers.length === 0) continue;

      const existing = groups.get(qualKey);
      const subjectEntry = { ...subject, papers: matchingPapers };

      if (existing) {
        existing.subjects.push(subjectEntry);
      } else {
        groups.set(qualKey, {
          key: qualKey,
          qualificationId: subject.qualification.id,
          level: subject.qualification.level,
          name: subject.qualification.name,
          subjects: [subjectEntry],
        });
      }
    }

    return [...groups.values()];
  }, [boardSubjects, search]);

  const visiblePaperIds = useMemo(
    () => filteredGroups.flatMap((group) => group.subjects.flatMap((subject) => subject.papers.map((paper) => paper.id))),
    [filteredGroups],
  );

  function togglePaper(paperId: string) {
    setDraftPaperIds((current) => {
      const next = new Set(current);
      if (next.has(paperId)) next.delete(paperId);
      else next.add(paperId);
      return next;
    });
    setSaveMessage(null);
  }

  function setPaperSelection(paperIds: string[], selected: boolean) {
    setDraftPaperIds((current) => {
      const next = new Set(current);
      for (const paperId of paperIds) {
        if (selected) next.add(paperId);
        else next.delete(paperId);
      }
      return next;
    });
    if (selected) setDraftEnabled(true);
    setSaveMessage(null);
  }

  function selectVisible() {
    setDraftPaperIds(new Set(visiblePaperIds));
    setDraftEnabled(true);
    setSaveMessage(null);
  }

  function clearVisible() {
    setDraftPaperIds((current) => {
      const next = new Set(current);
      for (const paperId of visiblePaperIds) next.delete(paperId);
      return next;
    });
    setSaveMessage(null);
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
          paperIds: [...draftPaperIds],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save");

      setSelections((current) => ({
        ...current,
        [activeBoardId]: data.paperIds,
      }));
      setExamBoards((current) =>
        current.map((board) =>
          board.id === activeBoardId
            ? { ...board, calendarSubjectFilterEnabled: data.enabled }
            : board,
        ),
      );
      setSaveMessage("Saved. Calendar will only show selected papers for this exam board.");
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
        description="Choose which papers appear on the calendar for each exam board."
      />

      <Card className="mb-6">
        <p className="text-sm text-slate-600">
          By default, all papers are shown. Enable filtering for an exam board and tick the
          paper codes you need.{" "}
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
                        ? `${selectedCount} paper${selectedCount === 1 ? "" : "s"} selected`
                        : "All papers"}
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
                    ? `${draftPaperIds.size} paper${draftPaperIds.size === 1 ? "" : "s"} selected`
                    : "Showing all papers on the calendar"}
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
                Limit calendar to selected papers
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search qualification, subject, or paper code..."
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

            <div className={`mt-6 space-y-8 ${draftEnabled ? "" : "opacity-60"}`}>
              {filteredGroups.length === 0 ? (
                <p className="text-sm text-slate-500">No subjects or papers match your search.</p>
              ) : (
                filteredGroups.map((group) => {
                  const groupPaperIds = group.subjects.flatMap((subject) =>
                    subject.papers.map((paper) => paper.id),
                  );
                  const groupState = selectionState(
                    groupPaperIds.filter((paperId) => draftPaperIds.has(paperId)).length,
                    groupPaperIds.length,
                  );

                  return (
                    <section key={group.key} className="rounded-xl border border-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {group.level}
                          {group.name !== group.level ? (
                            <span className="font-normal text-slate-600"> · {group.name}</span>
                          ) : null}
                        </h3>
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={groupState.allSelected}
                            ref={(element) => {
                              if (element) element.indeterminate = groupState.someSelected;
                            }}
                            disabled={!draftEnabled}
                            onChange={(event) =>
                              setPaperSelection(groupPaperIds, event.target.checked)
                            }
                            className="rounded border-slate-300 text-indigo-600"
                          />
                          Select all papers ({groupState.selectedCount}/{groupPaperIds.length})
                        </label>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {group.subjects.map((subject) => {
                          const subjectPaperIds = subject.papers.map((paper) => paper.id);
                          const subjectState = selectionState(
                            subjectPaperIds.filter((paperId) => draftPaperIds.has(paperId)).length,
                            subjectPaperIds.length,
                          );

                          return (
                            <div key={subject.id} className="px-4 py-3">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {subject.code} · {subject.name}
                                  </p>
                                </div>
                                {subject.papers.length > 1 ? (
                                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={subjectState.allSelected}
                                      ref={(element) => {
                                        if (element) {
                                          element.indeterminate = subjectState.someSelected;
                                        }
                                      }}
                                      disabled={!draftEnabled}
                                      onChange={(event) =>
                                        setPaperSelection(subjectPaperIds, event.target.checked)
                                      }
                                      className="rounded border-slate-300 text-indigo-600"
                                    />
                                    All papers ({subjectState.selectedCount}/{subjectPaperIds.length})
                                  </label>
                                ) : null}
                              </div>

                              <div className="space-y-1">
                                {subject.papers.map((paper) => (
                                  <label
                                    key={paper.id}
                                    className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={draftPaperIds.has(paper.id)}
                                      disabled={!draftEnabled}
                                      onChange={() => togglePaper(paper.id)}
                                      className="mt-0.5 rounded border-slate-300 text-indigo-600"
                                    />
                                    <span className="min-w-0 text-sm">
                                      <span className="font-medium text-slate-900">{paper.code}</span>
                                      <span className="text-slate-600"> · {paper.title}</span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
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
