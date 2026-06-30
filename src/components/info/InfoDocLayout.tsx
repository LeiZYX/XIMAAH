import Link from "next/link";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";

export function InfoDocLayout({
  title,
  description,
  toc,
  children,
}: {
  title: string;
  description?: string;
  toc: Array<{ id: string; label: string }>;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="border-b border-slate-200 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p> : null}
        </header>

        <nav aria-label="Table of contents" className="my-6 border-b border-slate-100 pb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contents</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {toc.map((item, index) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-indigo-700 hover:underline">
                  {index + 1}. {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="space-y-10 text-sm leading-relaxed text-slate-800">{children}</article>

        <footer className="mt-12 border-t border-slate-100 pt-6 text-sm text-slate-500">
          <Link href="/calendar" className="text-indigo-700 hover:underline">
            Back to calendar
          </Link>
        </footer>
      </main>
    </div>
  );
}

export function InfoSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function InfoAlert({ children }: { children: ReactNode }) {
  return (
    <div className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      {children}
    </div>
  );
}
