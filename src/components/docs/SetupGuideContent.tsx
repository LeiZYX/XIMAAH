import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

type GuideBase = "/admin" | "/exam-office";

function Step({
  n,
  title,
  href,
  children,
}: {
  n: number;
  title: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
        {n}
      </span>
      <div>
        {href ? (
          <Link href={href} className="font-semibold text-indigo-700 hover:underline">
            {title}
          </Link>
        ) : (
          <p className="font-semibold text-slate-900">{title}</p>
        )}
        <p className="mt-0.5 text-sm text-slate-600">{children}</p>
      </div>
    </li>
  );
}

export function SetupGuideContent({ basePath = "/admin" }: { basePath?: GuideBase }) {
  const isAdmin = basePath === "/admin";
  const a = (path: string) => (isAdmin ? `/admin${path}` : null);
  const shared = (path: string) => `${basePath}${path}`;

  return (
    <div className="space-y-6">
      <Card className="border-indigo-100 bg-indigo-50/50">
        <p className="text-sm font-medium text-indigo-950">One-line setup order</p>
        <p className="mt-2 space-y-1 text-base leading-relaxed text-slate-800">
          <span className="block">
            <span className="font-semibold">Structure:</span> Board → Qualification → Subject → Paper
          </span>
          <span className="block">
            <span className="font-semibold">Time:</span> Series → Sessions
          </span>
          <span className="block">
            <span className="font-semibold">Operations:</span> Calendar Subjects → Registration
            Window → Fees
          </span>
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">1. Structure</h2>
          <p className="mt-1 text-sm text-slate-600">What can be examined — stable catalogue.</p>
          <ol className="mt-4 space-y-3">
            <Step n={1} title="Exam Board" href={shared("/exam-boards")}>
              Exam board master data (Edexcel, AQA, CIE…).
            </Step>
            <Step n={2} title="Qualification" href={a("/qualifications") ?? undefined}>
              Belongs to a board (e.g. IAL Mathematics).
            </Step>
            <Step n={3} title="Subject" href={a("/subjects") ?? undefined}>
              Belongs to a qualification (e.g. Physics).
            </Step>
            <Step n={4} title="Paper" href={a("/papers") ?? undefined}>
              Belongs to a subject — paper code/title stays stable across seasons.
            </Step>
          </ol>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">2. Time</h2>
          <p className="mt-1 text-sm text-slate-600">When each paper is sat — changes every season.</p>
          <ol className="mt-4 space-y-3">
            <Step n={1} title="Exam Series" href={a("/exam-series") ?? undefined}>
              An exam season for a board (e.g. Summer 2026).
            </Step>
            <Step n={2} title="Exam Sessions" href={a("/exam-sessions") ?? undefined}>
              Paper + Series + date/time. Same paper, different dates each season.
            </Step>
          </ol>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">3. Operations</h2>
          <p className="mt-1 text-sm text-slate-600">Calendar display, registration, and pricing.</p>
          <ol className="mt-4 space-y-3">
            {isAdmin ? (
              <Step n={1} title="Calendar Subjects" href="/admin/calendar-subjects">
                Choose which subjects/papers appear on the Assessment Calendar.
              </Step>
            ) : null}
            <Step
              n={isAdmin ? 2 : 1}
              title="Registration Window"
              href={shared("/registration-windows")}
            >
              Open registration for a series (optional included series).
            </Step>
            <Step n={isAdmin ? 3 : 2} title="Fees" href={shared("/registration-windows")}>
              On the window Fees tab: one row per series subject; Normal / Late / High Late cost &amp;
              sales.
            </Step>
          </ol>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">How the pieces connect</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            <span className="font-medium">Paper</span> is what is examined;{" "}
            <span className="font-medium">Exam Session</span> is that paper on a Series date/time.
          </li>
          <li>
            Students register for <span className="font-medium">Sessions</span> inside a{" "}
            <span className="font-medium">Registration Window</span>, not for Papers directly.
          </li>
          <li>
            <span className="font-medium">Fee rules</span> follow subjects that have Sessions in the
            window’s series. Sync after sessions exist; calendar subject ticks alone do not create
            fees.
          </li>
        </ul>
      </Card>
    </div>
  );
}
