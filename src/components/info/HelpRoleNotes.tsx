"use client";

import { useEffect, useState } from "react";
import { roleHelpNotes } from "@/lib/help-documentation";
import { InfoAlert } from "@/components/info/InfoDocLayout";

export function HelpRoleNotes() {
  const [role, setRole] = useState<keyof typeof roleHelpNotes | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const userRole = data?.user?.role;
        if (
          userRole === "STUDENT" ||
          userRole === "SUBJECT_TEACHER" ||
          userRole === "EXAM_OFFICER" ||
          userRole === "ADMIN"
        ) {
          setRole(userRole);
        }
      })
      .catch(() => setRole(null));
  }, []);

  if (!role) return null;

  const note = roleHelpNotes[role];

  return (
    <InfoAlert>
      <p className="font-medium">{note.title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {note.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </InfoAlert>
  );
}
