import { GlobalReviewRequestsList } from "@/components/post-results/GlobalReviewRequestsList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminReviewRequestsPage() {
  return <GlobalReviewRequestsList reviewWindowsBasePath="/admin/review-windows" />;
}
