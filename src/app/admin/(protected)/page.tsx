import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildFeeDashboardMetrics } from "@/lib/fees/reporting";
import { formatMoney } from "@/lib/fees/money";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STAT_LINKS = [
  { key: "examBoardCount", label: "Exam Boards", href: "/admin/exam-boards" },
  { key: "qualificationCount", label: "Qualifications", href: "/admin/qualifications" },
  { key: "subjectCount", label: "Subjects", href: "/admin/subjects" },
  { key: "paperCount", label: "Papers", href: "/admin/papers" },
  { key: "examSeriesCount", label: "Exam Series", href: "/admin/exam-series" },
  { key: "examSessionCount", label: "Exam Sessions", href: "/admin/exam-sessions" },
  { key: "keyDateCount", label: "Key Dates", href: "/admin/key-dates" },
] as const;

type StatCounts = Record<(typeof STAT_LINKS)[number]["key"], number>;

async function loadCounts(): Promise<{ counts: StatCounts | null; dbError: string | null }> {
  try {
    const [
      examBoardCount,
      qualificationCount,
      subjectCount,
      paperCount,
      examSeriesCount,
      examSessionCount,
      keyDateCount,
    ] = await Promise.all([
      prisma.examBoard.count(),
      prisma.qualification.count(),
      prisma.subject.count(),
      prisma.paper.count(),
      prisma.examSeries.count(),
      prisma.examSession.count(),
      prisma.keyDate.count(),
    ]);

    return {
      counts: {
        examBoardCount,
        qualificationCount,
        subjectCount,
        paperCount,
        examSeriesCount,
        examSessionCount,
        keyDateCount,
      },
      dbError: null,
    };
  } catch {
    return {
      counts: null,
      dbError:
        "Cannot connect to MySQL. Start the database, then run npm run db:migrate and npm run db:seed.",
    };
  }
}

export default async function AdminDashboardPage() {
  const { counts, dbError } = await loadCounts();
  let feeMetrics = null;
  if (!dbError) {
    try {
      feeMetrics = await buildFeeDashboardMetrics();
    } catch {
      feeMetrics = null;
    }
  }

  const feeSummaryHref = feeMetrics?.currentWindowId
    ? `/admin/fee-summary?registrationWindowId=${feeMetrics.currentWindowId}`
    : "/admin/fee-summary";

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="Manage exam data and keep the assessment calendar up to date."
      />

      {dbError ? (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <h2 className="text-sm font-semibold text-amber-900">Database not connected</h2>
          <p className="mt-2 text-sm text-amber-800">{dbError}</p>

          <div className="mt-4 space-y-4 text-sm text-amber-900">
            <div>
              <p className="font-medium">Option A — Docker (recommended)</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-4 text-xs text-slate-700">
{`docker compose up -d mysql
npm run db:migrate
npm run db:seed`}
              </pre>
            </div>
            <div>
              <p className="font-medium">Option B — Local MySQL</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-amber-800">
                <li>Install MySQL 8 locally and create the database</li>
                <li>
                  Set <code className="rounded bg-white px-1">DATABASE_URL</code> in{" "}
                  <code className="rounded bg-white px-1">.env</code> to your local connection
                  string
                </li>
                <li>
                  Run <code className="rounded bg-white px-1">npm run db:migrate</code> then{" "}
                  <code className="rounded bg-white px-1">npm run db:seed</code>
                </li>
              </ol>
            </div>
          </div>

          <p className="mt-4 text-sm text-amber-800">
            After seeding, refresh this page — AQA, CIE, and Edexcel will appear automatically.
          </p>
        </Card>
      ) : null}

      {feeMetrics ? (
        <>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Fee management</h2>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href={`${feeSummaryHref}&statementStatus=DRAFT`}>
              <Card className="transition hover:border-indigo-200 hover:shadow-md">
                <p className="text-sm font-medium text-slate-500">Fee statements pending</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {feeMetrics.feeStatementsPending}
                </p>
              </Card>
            </Link>
            <Link href={`${feeSummaryHref}`}>
              <Card className="transition hover:border-indigo-200 hover:shadow-md">
                <p className="text-sm font-medium text-slate-500">Missing fee rules</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {feeMetrics.missingFeeRules}
                </p>
              </Card>
            </Link>
            <Link href={feeSummaryHref}>
              <Card className="transition hover:border-indigo-200 hover:shadow-md">
                <p className="text-sm font-medium text-slate-500">
                  Total fees ({feeMetrics.currentWindowTitle ?? "current window"})
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatMoney(feeMetrics.totalFeesCurrentWindowGbp, "GBP")} ·{" "}
                  {formatMoney(feeMetrics.totalFeesCurrentWindowCny, "CNY")}
                </p>
              </Card>
            </Link>
            <Link href={`${feeSummaryHref}&statementStatus=ISSUED`}>
              <Card className="transition hover:border-indigo-200 hover:shadow-md">
                <p className="text-sm font-medium text-slate-500">Unpaid statements</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {feeMetrics.unpaidStatements}
                </p>
              </Card>
            </Link>
          </div>
        </>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_LINKS.map((stat) => (
          <Link key={stat.href} href={stat.href}>
            <Card className="transition hover:border-indigo-200 hover:shadow-md">
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {counts ? counts[stat.key] : "—"}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Quick start</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>Create exam boards (AQA, Edexcel, OCR, etc.)</li>
          <li>Add qualifications and subjects under each board</li>
          <li>Define papers for each subject</li>
          <li>Set up exam series (e.g. Summer 2026)</li>
          <li>Schedule exam sessions and key dates</li>
          <li>View everything on the calendar with filters</li>
        </ol>
      </Card>
    </div>
  );
}
