"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ReviewWindowDetailNavProps {
  windowId: string;
  basePath: "/admin/review-windows" | "/exam-office/review-windows";
  feeStatementsBasePath: "/admin/fee-statements" | "/exam-office/fee-statements";
}

export function ReviewWindowDetailNav({
  windowId,
  basePath,
  feeStatementsBasePath,
}: ReviewWindowDetailNavProps) {
  const pathname = usePathname();
  const prefix = `${basePath}/${windowId}`;

  const tabs = [
    { href: prefix, label: "General", match: (p: string) => p === prefix },
    {
      href: `${prefix}/services`,
      label: "Available Services",
      match: (p: string) => p.startsWith(`${prefix}/services`),
    },
    {
      href: `${prefix}/review-requests`,
      label: "Review Requests",
      match: (p: string) => p.startsWith(`${prefix}/review-requests`),
    },
    {
      href: `${prefix}/cash-in-requests`,
      label: "Cash-in Requests",
      match: (p: string) => p.startsWith(`${prefix}/cash-in-requests`),
    },
    {
      href: `${prefix}/access-to-script`,
      label: "Access to Script",
      match: (p: string) => p.startsWith(`${prefix}/access-to-script`),
    },
    {
      href: `${prefix}/certificate-requests`,
      label: "Certificate Requests",
      match: (p: string) => p.startsWith(`${prefix}/certificate-requests`),
    },
    {
      href: `${feeStatementsBasePath}?reviewWindowId=${windowId}&businessType=POST_RESULTS`,
      label: "Fee Statements",
      match: () => false,
      external: true,
    },
    {
      href: `${prefix}/reports`,
      label: "Reports",
      match: (p: string) => p.startsWith(`${prefix}/reports`),
    },
    {
      href: `${prefix}/audit-log`,
      label: "Audit Log",
      match: (p: string) => p.startsWith(`${prefix}/audit-log`),
    },
    { href: basePath, label: "All windows", match: (p: string) => p === basePath },
  ];

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        const className = `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          active
            ? "bg-indigo-600 text-white"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`;

        if ("external" in tab && tab.external) {
          return (
            <Link key={tab.href} href={tab.href} className={className}>
              {tab.label}
            </Link>
          );
        }

        return (
          <Link key={tab.href} href={tab.href} className={className}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
