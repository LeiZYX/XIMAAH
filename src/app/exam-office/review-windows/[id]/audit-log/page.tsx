import { ReviewWindowAuditLog } from "@/components/review-windows/ReviewWindowAuditLog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeReviewWindowAuditLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ReviewWindowAuditLog
      windowId={id}
      basePath="/exam-office/review-windows"
      feeStatementsBasePath="/exam-office/fee-statements"
    />
  );
}
