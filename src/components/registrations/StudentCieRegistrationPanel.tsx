"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CieOptionRegistrationForm } from "@/components/registrations/CieOptionRegistrationForm";
import { isCieExamBoard } from "@/lib/exam-boards/branch";

type OpenWindow = {
  id: string;
  title: string;
  examBoard: { code: string; name: string };
};

interface StudentCieRegistrationPanelProps {
  onChanged?: () => void;
}

export function StudentCieRegistrationPanel({ onChanged }: StudentCieRegistrationPanelProps) {
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [windowId, setWindowId] = useState("");

  const loadWindows = useCallback(async () => {
    const res = await fetch("/api/registration-windows?scope=student&allYears=true");
    if (!res.ok) return;
    const data = (await res.json()) as OpenWindow[];
    const list = Array.isArray(data) ? data : [];
    const cie = list.filter((w) => isCieExamBoard(w.examBoard?.code ?? "", w.examBoard?.name));
    setWindows(cie);
    if (cie[0] && !windowId) setWindowId(cie[0].id);
  }, [windowId]);

  useEffect(() => {
    void loadWindows();
  }, [loadWindows]);

  if (windows.length === 0) return null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Cambridge (CIE) registration</h2>
        <p className="text-sm text-slate-600">
          Select a syllabus option, or compose components until they match a valid option. Withdraw
          removes the whole syllabus.
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Registration window</span>
        <select
          value={windowId}
          onChange={(e) => setWindowId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {windows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>
      </label>

      {windowId ? (
        <CieOptionRegistrationForm
          registrationWindowId={windowId}
          onSuccess={() => onChanged?.()}
        />
      ) : null}
    </Card>
  );
}
