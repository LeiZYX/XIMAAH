"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface RegistrationWindowDetailNavProps {
  windowId: string;
  basePath: "/admin/registration-windows" | "/exam-office/registration-windows";
}

export function RegistrationWindowDetailNav({
  windowId,
  basePath,
}: RegistrationWindowDetailNavProps) {
  const pathname = usePathname();
  const feesHref = `${basePath}/${windowId}/fees`;

  const tabs = [
    { href: basePath, label: "All windows", exact: true },
    { href: feesHref, label: "Fee Rules", exact: false },
  ];

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {tabs.map((tab) => {
        const active = tab.href === feesHref
          ? pathname.startsWith(feesHref)
          : pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href === basePath ? basePath : tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
