import { ReviewWindowGeneral } from "@/components/review-windows/ReviewWindowGeneral";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExamOfficeReviewWindowGeneralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ReviewWindowGeneral
      windowId={id}
      basePath="/exam-office/review-windows"
      feeStatementsBasePath="/exam-office/fee-statements"
    />
  );
}
