"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CandidatesSubnav({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  const links = [
    { href: basePath, label: "All Candidates", exact: true },
    { href: `${basePath}/internal`, label: "Internal Candidates" },
    { href: `${basePath}/external`, label: "External Candidates" },
    { href: `${basePath}/numbers`, label: "Candidate Numbers" },
    { href: `${basePath}/import`, label: "Import / Export" },
  ];

  return (
    <nav className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {links.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded px-3 py-1.5 text-sm ${
              active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
