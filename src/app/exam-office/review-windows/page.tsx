import { ReviewWindowManager } from "@/components/review-windows/ReviewWindowManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeReviewWindowsPage() {
  return <ReviewWindowManager basePath="/exam-office/review-windows" />;
}
