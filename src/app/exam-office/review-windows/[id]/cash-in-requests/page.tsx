import Link from "next/link";
import { ReviewWindowDetailShell } from "@/components/review-windows/ReviewWindowDetailShell";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeReviewWindowCashInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ReviewWindowDetailShell
      windowId={id}
      basePath="/exam-office/review-windows"
      feeStatementsBasePath="/exam-office/fee-statements"
    >
      <Card className="space-y-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Cash-in is managed outside review windows.</p>
        <p>
          Create and track cash-in requests on the global Cash-in Requests page. Cancellation is
          allowed only before a request is marked sent to the board.
        </p>
        <Link href="/exam-office/cash-in-requests" className="text-indigo-700 hover:underline">
          Open Cash-in Requests
        </Link>
      </Card>
    </ReviewWindowDetailShell>
  );
}
