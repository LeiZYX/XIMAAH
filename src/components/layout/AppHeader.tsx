"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const navLinks = [
  { href: "/calendar", label: "Calendar" },
  { href: "/login", label: "Sign in" },
];

export function AppHeader() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string; homePath?: string } | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.replace("/calendar");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            X
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">XIMA Assessment Hub</p>
            <p className="text-xs text-slate-500">Exam planning & scheduling</p>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/calendar"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Calendar
          </Link>
          {user?.role === "STUDENT" ? (
            <Link
              href="/student/registrations"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              My Exam Registrations
            </Link>
          ) : null}
          {user?.homePath && user.role !== "STUDENT" ? (
            <Link
              href={user.homePath}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Dashboard
            </Link>
          ) : null}
          {user ? (
            <>
              <span className="px-2 text-xs text-slate-500">{user.name}</span>
              <Link
                href="/account/change-password"
                className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Password
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Sign out
              </button>
            </>
          ) : (
            navLinks.slice(1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))
          )}
        </nav>
      </div>
    </header>
  );
}
