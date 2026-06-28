"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface WindowRow {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  examBoard: { id: string; name: string; code: string };
  examSeries: { id: string; name: string; year: number };
}

interface RegistrationWindowManagerProps {
  feesBasePath?: "/admin/registration-windows" | "/exam-office/registration-windows";
}

export function RegistrationWindowManager({
  feesBasePath = "/admin/registration-windows",
}: RegistrationWindowManagerProps) {
  const [windows, setWindows] = useState<WindowRow[]>([]);
  const [boards, setBoards] = useState<{ id: string; code: string }[]>([]);
  const [series, setSeries] = useState<{ id: string; name: string; year: number; examBoardId: string }[]>([]);
  const [form, setForm] = useState({
    examBoardId: "",
    examSeriesId: "",
    title: "",
    startAt: "",
    endAt: "",
    status: "DRAFT",
  });

  async function load() {
    const [w, b, s] = await Promise.all([
      fetch("/api/registration-windows").then((r) => r.json()),
      fetch("/api/exam-boards").then((r) => r.json()),
      fetch("/api/exam-series").then((r) => r.json()),
    ]);
    setWindows(Array.isArray(w) ? w : []);
    setBoards(Array.isArray(b) ? b : []);
    setSeries(Array.isArray(s) ? s : []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/registration-windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ examBoardId: "", examSeriesId: "", title: "", startAt: "", endAt: "", status: "DRAFT" });
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
        description="Configure when students can register for exams by board and series."
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
          <input
            required
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => setForm({ ...form, endAt: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
            Create
          </button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-2 pr-4 text-left">Title</th>
              <th className="py-2 pr-4 text-left">Board</th>
              <th className="py-2 pr-4 text-left">Series</th>
              <th className="py-2 pr-4 text-left">Period</th>
              <th className="py-2 pr-4 text-left">Status</th>
              <th className="py-2 pr-4 text-left">Actions</th>
              <th className="py-2 pr-4 text-left">Fees</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((window) => (
              <tr key={window.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">{window.title}</td>
                <td className="py-2 pr-4">{window.examBoard.code}</td>
                <td className="py-2 pr-4">
                  {window.examSeries.name} ({window.examSeries.year})
                </td>
                <td className="py-2 pr-4">
                  {window.startAt.slice(0, 16).replace("T", " ")} –{" "}
                  {window.endAt.slice(0, 16).replace("T", " ")}
                </td>
                <td className="py-2 pr-4">{window.status}</td>
                <td className="py-2 pr-4">
                  <div className="flex gap-2">
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
                <td className="py-2 pr-4">
                  <Link
                    href={`${feesBasePath}/${window.id}/fees`}
                    className="text-indigo-600 hover:underline"
                  >
                    Fee rules
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
