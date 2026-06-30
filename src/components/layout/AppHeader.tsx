"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type NavLink = {
  href: string;
  label: string;
};

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; role: string; homePath?: string } | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMenuOpen(false);
    router.replace("/calendar");
    router.refresh();
  }

  const navLinks = useMemo((): NavLink[] => {
    const links: NavLink[] = [{ href: "/calendar", label: "Calendar" }];

    if (user?.role === "STUDENT") {
      links.push(
        { href: "/student/registrations", label: "My Exam Registrations" },
        { href: "/student/fee-statements", label: "Fee Statements" },
      );
    } else if (user?.role === "TEACHER") {
      links.push({ href: "/teacher/class-registrations", label: "Class Registrations" });
    } else if (user?.homePath && user.role !== "STUDENT") {
      links.push({ href: user.homePath, label: "Dashboard" });
    }

    if (user) {
      links.push(
        { href: "/about", label: "About" },
        { href: "/help", label: "Help" },
        { href: "/account/change-password", label: "Password" },
      );
    } else {
      links.push({ href: "/login", label: "Sign in" });
    }

    return links;
  }, [user]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function renderNavLink(link: NavLink, mobile = false) {
    const active = isActive(link.href);
    return (
      <Link
        key={`${mobile ? "m" : "d"}-${link.href}-${link.label}`}
        href={link.href}
        onClick={() => setMenuOpen(false)}
        className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          mobile
            ? active
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-700 hover:bg-slate-100"
            : active
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        {link.label}
      </Link>
    );
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            X
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">XIMA Assessment Hub</p>
            <p className="hidden text-xs text-slate-500 sm:block">
              Exam planning & scheduling
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => renderNavLink(link))}
          {user ? (
            <>
              <span className="max-w-[8rem] truncate px-2 text-xs text-slate-500">{user.name}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Sign out
              </button>
            </>
          ) : null}
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          {user ? (
            <span className="max-w-[5rem] truncate text-xs text-slate-500 sm:max-w-[8rem]">
              {user.name}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
            aria-label="Close menu overlay"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="mobile-nav"
            className="relative z-50 border-t border-slate-200 bg-white px-4 py-3 lg:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {navLinks.map((link) => renderNavLink(link, true))}
              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Sign out
                </button>
              ) : null}
            </div>
          </nav>
        </>
      ) : null}
    </header>
  );
}
