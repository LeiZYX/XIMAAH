import { GlobalReviewRequestsList } from "@/components/post-results/GlobalReviewRequestsList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeReviewRequestsPage() {
  return <GlobalReviewRequestsList reviewWindowsBasePath="/exam-office/review-windows" />;
}
