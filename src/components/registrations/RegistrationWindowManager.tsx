"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { datetimeLocalValueToIso } from "@/lib/datetime-local";

interface WindowRow {
  id: string;
  title: string;
  studentRegistrationOpenAt: string;
  studentRegistrationCloseAt: string;
  registrationCloseAt: string;
  status: string;
  studentStateLabel?: string;
  currentFeeStage?: string;
  totalRegistrations?: number;
  examBoard: { id: string; name: string; code: string };
  examSeries: { id: string; name: string; year: number };
}

interface RegistrationWindowManagerProps {
  basePath?: "/admin/registration-windows" | "/exam-office/registration-windows";
}

function statusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "OPEN":
      return "Open";
    case "CLOSED":
      return "Closed";
    default:
      return status;
  }
}

export function RegistrationWindowManager({
  basePath = "/admin/registration-windows",
}: RegistrationWindowManagerProps) {
  const [windows, setWindows] = useState<WindowRow[]>([]);
  const [boards, setBoards] = useState<{ id: string; code: string }[]>([]);
  const [series, setSeries] = useState<{ id: string; name: string; year: number; examBoardId: string }[]>([]);
  const [form, setForm] = useState({
    examBoardId: "",
    examSeriesId: "",
    title: "",
    studentRegistrationOpenAt: "",
    studentRegistrationCloseAt: "",
    registrationCloseAt: "",
    status: "DRAFT",
  });

  async function load() {
    try {
      const [windowsRes, boardsRes, seriesRes] = await Promise.all([
        fetch("/api/registration-windows"),
        fetch("/api/exam-boards"),
        fetch("/api/exam-series"),
      ]);

      const [w, b, s] = await Promise.all([
        windowsRes.ok ? windowsRes.json() : [],
        boardsRes.ok ? boardsRes.json() : [],
        seriesRes.ok ? seriesRes.json() : [],
      ]);

      setWindows(Array.isArray(w) ? w : []);
      setBoards(Array.isArray(b) ? b : []);
      setSeries(Array.isArray(s) ? s : []);
    } catch {
      setWindows([]);
      setBoards([]);
      setSeries([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/registration-windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        studentRegistrationOpenAt: datetimeLocalValueToIso(form.studentRegistrationOpenAt),
        studentRegistrationCloseAt: datetimeLocalValueToIso(form.studentRegistrationCloseAt),
        registrationCloseAt: datetimeLocalValueToIso(form.registrationCloseAt),
      }),
    });
    setForm({
      examBoardId: "",
      examSeriesId: "",
      title: "",
      studentRegistrationOpenAt: "",
      studentRegistrationCloseAt: "",
      registrationCloseAt: "",
      status: "DRAFT",
    });
    load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/registration-windows/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const filteredSeries = series.filter((item) =>
    form.examBoardId ? item.examBoardId === form.examBoardId : true,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registration windows"
        description="Configure student registration periods, optional fee stages, and fees by board and series."
      />

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Create window</h2>
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
          <select
            required
            value={form.examBoardId}
            onChange={(e) => setForm({ ...form, examBoardId: e.target.value, examSeriesId: "" })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Exam board</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.code}
              </option>
            ))}
          </select>
          <select
            required
            value={form.examSeriesId}
            onChange={(e) => setForm({ ...form, examSeriesId: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Exam series</option>
            {filteredSeries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.year})
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="DRAFT">Draft</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </select>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">
              Student registration open
              <span className="ml-1 font-normal text-slate-400">(Normal fee stage start)</span>
            </span>
            <input
              required
              type="datetime-local"
              value={form.studentRegistrationOpenAt}
              onChange={(e) => setForm({ ...form, studentRegistrationOpenAt: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">
              Student registration close
              <span className="ml-1 font-normal text-slate-400">(Normal fee stage end)</span>
            </span>
            <input
              required
              type="datetime-local"
              value={form.studentRegistrationCloseAt}
              onChange={(e) => setForm({ ...form, studentRegistrationCloseAt: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">
              Registration close
              <span className="ml-1 font-normal text-slate-400">(High Late Entry end)</span>
            </span>
            <input
              required
              type="datetime-local"
              value={form.registrationCloseAt}
              onChange={(e) => setForm({ ...form, registrationCloseAt: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
            Create
          </button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-2 pr-4 text-left">Window</th>
              <th className="py-2 pr-4 text-left">Board</th>
              <th className="py-2 pr-4 text-left">Series</th>
              <th className="py-2 pr-4 text-left">Status</th>
              <th className="py-2 pr-4 text-left">Student open</th>
              <th className="py-2 pr-4 text-left">Student close</th>
              <th className="py-2 pr-4 text-left">Window close</th>
              <th className="py-2 pr-4 text-left">Student state</th>
              <th className="py-2 pr-4 text-left">Fee stage</th>
              <th className="py-2 pr-4 text-left">Registrations</th>
              <th className="py-2 pr-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((window) => (
              <tr key={window.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">
                  <Link href={`${basePath}/${window.id}`} className="font-medium text-indigo-600 hover:underline">
                    {window.title}
                  </Link>
                </td>
                <td className="py-2 pr-4">{window.examBoard.code}</td>
                <td className="py-2 pr-4">
                  {window.examSeries.name} ({window.examSeries.year})
                </td>
                <td className="py-2 pr-4">{statusLabel(window.status)}</td>
                <td className="py-2 pr-4 text-xs text-slate-600">{new Date(window.studentRegistrationOpenAt).toLocaleString()}</td>
                <td className="py-2 pr-4 text-xs text-slate-600">{new Date(window.studentRegistrationCloseAt).toLocaleString()}</td>
                <td className="py-2 pr-4 text-xs text-slate-600">{new Date(window.registrationCloseAt).toLocaleString()}</td>
                <td className="py-2 pr-4">{window.studentStateLabel ?? "—"}</td>
                <td className="py-2 pr-4">{window.currentFeeStage ?? "Not Configured"}</td>
                <td className="py-2 pr-4">{window.totalRegistrations ?? 0}</td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`${basePath}/${window.id}`} className="text-indigo-600 hover:underline">
                      Manage
                    </Link>
                    {window.status !== "OPEN" ? (
                      <button
                        type="button"
                        onClick={() => updateStatus(window.id, "OPEN")}
                        className="text-indigo-600"
                      >
                        Open
                      </button>
                    ) : null}
                    {window.status !== "CLOSED" ? (
                      <button
                        type="button"
                        onClick={() => updateStatus(window.id, "CLOSED")}
                        className="text-slate-600"
                      >
                        Close
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
