import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminReviewWindowReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Post-results reports"
        description="Reports for this review window will be available in a future release."
      />
      <p className="text-sm text-slate-600">
        Review window ID: <span className="font-mono text-slate-800">{id}</span>
      </p>
    </div>
  );
}
