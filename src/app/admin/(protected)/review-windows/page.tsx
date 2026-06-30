import { ReviewWindowManager } from "@/components/review-windows/ReviewWindowManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminReviewWindowsPage() {
  return <ReviewWindowManager basePath="/admin/review-windows" />;
}
