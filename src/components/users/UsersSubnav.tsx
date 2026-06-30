"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const userLinks = [
  { href: "/admin/users", label: "All Users", exact: true },
  { href: "/admin/users/students", label: "Students" },
  { href: "/admin/users/teachers", label: "Teachers" },
  { href: "/admin/users/import", label: "Import / Export" },
  { href: "/admin/users/promotion", label: "Class Promotion" },
  { href: "/admin/users/password-settings", label: "Password & Email Settings" },
];

export function UsersSubnav() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {userLinks.map((link) => {
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
