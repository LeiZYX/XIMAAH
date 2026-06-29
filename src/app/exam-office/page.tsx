import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildFeeDashboardMetrics } from "@/lib/fees/reporting";
import { formatMoney } from "@/lib/fees/money";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeDashboardPage() {
  let feeMetrics = null;
  try {
    feeMetrics = await buildFeeDashboardMetrics();
  } catch {
    feeMetrics = null;
  }

  const feeSummaryHref = feeMetrics?.currentWindowId
    ? `/exam-office/fee-summary?registrationWindowId=${feeMetrics.currentWindowId}`
    : "/exam-office/fee-summary";

  return (
    <div>
      <PageHeader
        title="Exam Office Dashboard"
        description="Registrations, candidates, and fee management."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/exam-office/registrations">
          <Card className="transition hover:border-indigo-200 hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">Registrations</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">Manage & adjust</p>
          </Card>
        </Link>
        <Link href="/exam-office/candidates">
          <Card className="transition hover:border-indigo-200 hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">Candidates</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">Internal & external</p>
          </Card>
        </Link>
        <Link href="/exam-office/fee-summary">
          <Card className="transition hover:border-indigo-200 hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">Fee summary</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">Reports & export</p>
          </Card>
        </Link>
      </div>

      {feeMetrics ? (
        <>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Fee management</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href={`${feeSummaryHref}&statementStatus=DRAFT`}>
              <Card className="transition hover:border-indigo-200 hover:shadow-md">
                <p className="text-sm font-medium text-slate-500">Fee statements pending</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {feeMetrics.feeStatementsPending}
                </p>
              </Card>
            </Link>
            <Link href={feeSummaryHref}>
              <Card className="transition hover:border-indigo-200 hover:shadow-md">
                <p className="text-sm font-medium text-slate-500">Missing fee rules</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {feeMetrics.missingFeeRules}
                </p>
              </Card>
            </Link>
            <Link href={feeSummaryHref}>
              <Card className="transition hover:border-indigo-200 hover:shadow-md">
                <p className="text-sm font-medium text-slate-500">Total fees (current window)</p>
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
    </div>
  );
}
