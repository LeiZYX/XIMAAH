"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const adminLinks = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/exam-boards", label: "Exam Boards" },
  { href: "/admin/qualifications", label: "Qualifications" },
  { href: "/admin/subjects", label: "Subjects" },
  { href: "/admin/calendar-subjects", label: "Calendar Subjects" },
  { href: "/admin/papers", label: "Papers" },
  { href: "/admin/exam-series", label: "Exam Series" },
  { href: "/admin/exam-sessions", label: "Exam Sessions" },
  { href: "/admin/key-dates", label: "Key Dates" },
  { href: "/admin/import", label: "Import" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setUserName(data?.user?.name ?? null))
      .catch(() => setUserName(null));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className="sticky top-0 flex flex-1 flex-col p-4">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Admin
        </p>
        <nav className="space-y-1">
          {adminLinks.map((link) => {
            const active = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-700 hover:bg-white hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-200 pt-4">
          {userName ? (
            <p className="mb-2 px-3 text-xs text-slate-500">Signed in as {userName}</p>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-white hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
