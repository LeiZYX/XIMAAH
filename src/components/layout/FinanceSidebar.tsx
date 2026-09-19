"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/finance/fee-statements", label: "Fee Statements" },
  { href: "/finance/offline-withdrawal-refunds", label: "Offline Refunds" },
  { href: "/finance/fee-summary", label: "Fee Summary" },
  { href: "/finance/fee-details", label: "Fee Details" },
  { href: "/finance/fees/export", label: "Exports" },
  { href: "/finance/reports/fees", label: "Fee Reports" },
];

export function FinanceSidebar() {
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
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className="sticky top-0 flex max-h-screen flex-1 flex-col overflow-y-auto p-4">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Finance
        </p>
        <div className="space-y-1">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
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
        </div>
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
