"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarLink {
  href: string;
  label: string;
  exact?: boolean;
}

export interface SidebarSection {
  title: string;
  links: SidebarLink[];
}

interface StaffSidebarNavProps {
  sections: SidebarSection[];
  footerLinks?: SidebarLink[];
}

export function StaffSidebarNav({ sections, footerLinks = [] }: StaffSidebarNavProps) {
  const pathname = usePathname();

  function isActive(link: SidebarLink): boolean {
    if (link.exact) return pathname === link.href;
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  return (
    <nav className="space-y-5">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {section.title}
          </p>
          <div className="space-y-1">
            {section.links.map((link) => {
              const active = isActive(link);
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
        </div>
      ))}
      {footerLinks.length > 0 ? (
        <div className="space-y-1 border-t border-slate-200 pt-4">
          {footerLinks.map((link) => {
            const active = isActive(link);
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
      ) : null}
    </nav>
  );
}

export function adminStaffSections(base: "/admin" | "/exam-office"): SidebarSection[] {
  const prefix = base;
  return [
    {
      title: "Pre-Exam",
      links: [
        { href: `${prefix}/registration-windows`, label: "Registration Windows" },
        { href: `${prefix}/registrations`, label: "Registrations" },
        { href: `${prefix}/candidate-board-registrations`, label: "Candidate Board Registration" },
        {
          href: `${prefix}/fee-statements?businessType=REGISTRATION`,
          label: "Registration Fee Statements",
        },
      ],
    },
    {
      title: "Post-Results",
      links: [
        { href: `${prefix}/review-windows`, label: "Review Windows" },
        { href: `${prefix}/review-requests`, label: "Review Requests" },
        { href: `${prefix}/cash-in-requests`, label: "Cash-in Requests" },
        { href: `${prefix}/access-to-script`, label: "Access to Script" },
        { href: `${prefix}/certificate-requests`, label: "Certificate Requests" },
      ],
    },
    {
      title: "Fee Management",
      links: [
        { href: `${prefix}/fee-schedules`, label: "Fee Schedule" },
        { href: `${prefix}/fee-statements`, label: "Fee Statements" },
        { href: `${prefix}/fee-summary`, label: "Fee Summary" },
        { href: `${prefix}/fee-details`, label: "Fee Details" },
        { href: `${prefix}/fees/export`, label: "Exports" },
      ],
    },
    {
      title: "Reports",
      links: [
        { href: `${prefix}/reports/registration`, label: "Registration Reports" },
        { href: `${prefix}/reports/post-results`, label: "Post-Results Reports" },
        { href: `${prefix}/reports/fees`, label: "Fee Reports" },
      ],
    },
    {
      title: "Audit Logs",
      links: [{ href: `${prefix}/audit-logs`, label: "Audit Logs" }],
    },
  ];
}
