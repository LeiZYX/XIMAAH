"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface RegistrationWindowDetailNavProps {
  windowId: string;
  basePath: "/admin/registration-windows" | "/exam-office/registration-windows";
  reportsBasePath: "/admin/fee-summary" | "/exam-office/fee-summary";
  registrationsBasePath: "/admin/registrations" | "/exam-office/registrations";
  feeStatementsBasePath: "/admin/fee-statements" | "/exam-office/fee-statements";
}

export function RegistrationWindowDetailNav({
  windowId,
  basePath,
  reportsBasePath,
  registrationsBasePath,
  feeStatementsBasePath,
}: RegistrationWindowDetailNavProps) {
  const pathname = usePathname();
  const prefix = `${basePath}/${windowId}`;

  const tabs = [
    { href: prefix, label: "General", match: (p: string) => p === prefix },
    { href: `${prefix}/fee-stages`, label: "Fee Stages", match: (p: string) => p.startsWith(`${prefix}/fee-stages`) || p.startsWith(`${prefix}/stages`) },
    { href: `${prefix}/fees`, label: "Fee Rules", match: (p: string) => p.startsWith(`${prefix}/fees`) },
    {
      href: `${registrationsBasePath}?registrationWindowId=${windowId}`,
      label: "Registrations",
      match: () => false,
      external: true,
    },
    {
      href: `${feeStatementsBasePath}?registrationWindowId=${windowId}`,
      label: "Fee Statements",
      match: () => false,
      external: true,
    },
    {
      href: `${reportsBasePath}?registrationWindowId=${windowId}`,
      label: "Reports",
      match: () => false,
      external: true,
    },
    { href: `${prefix}/audit-log`, label: "Audit Log", match: (p: string) => p.startsWith(`${prefix}/audit-log`) },
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

        if (tab.external) {
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
