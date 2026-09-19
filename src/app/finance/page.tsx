import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildFeeDashboardMetrics } from "@/lib/fees/reporting";
import { formatMoney } from "@/lib/fees/money";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinanceDashboardPage() {
  let feeMetrics = null;
  try {
    feeMetrics = await buildFeeDashboardMetrics();
  } catch {
    feeMetrics = null;
  }

  const feeSummaryHref = feeMetrics?.currentWindowId
    ? `/finance/fee-summary?registrationWindowId=${feeMetrics.currentWindowId}`
    : "/finance/fee-summary";
  const feeSummaryWithStatus = (status: string) => {
    const params = new URLSearchParams();
    if (feeMetrics?.currentWindowId) {
      params.set("registrationWindowId", feeMetrics.currentWindowId);
    }
    params.set("statementStatus", status);
    return `/finance/fee-summary?${params.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Fee statements, refunds, summaries, and exports."
      />

      {feeMetrics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link href={feeSummaryWithStatus("DRAFT")}>
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
          <Link href={feeSummaryWithStatus("ISSUED")}>
            <Card className="transition hover:border-indigo-200 hover:shadow-md">
              <p className="text-sm font-medium text-slate-500">Unpaid statements</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {feeMetrics.unpaidStatements}
              </p>
            </Card>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
