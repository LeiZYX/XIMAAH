import Link from "next/link";

const navLinks = [
  { href: "/calendar", label: "Calendar" },
  { href: "/admin", label: "Admin" },
];

export function AppHeader() {
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
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
