"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface FeeManagementNavProps {
  basePath: "/admin" | "/exam-office";
}

const feeLinks = (base: string) => [
  { href: `${base}/fee-rules`, label: "Fee Rules" },
  { href: `${base}/fee-statements`, label: "Fee Statements" },
  { href: `${base}/fee-summary`, label: "Fee Summary" },
  { href: `${base}/fee-details`, label: "Fee Details" },
  { href: `${base}/fee-statements/batch-print`, label: "Batch Print" },
  { href: `${base}/fees/export`, label: "Export" },
];

export function FeeManagementNav({ basePath }: FeeManagementNavProps) {
  const pathname = usePathname();
  const links = feeLinks(basePath);

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      <span className="self-center px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Fee Management
      </span>
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
