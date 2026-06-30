import { PageHeader } from "@/components/ui/PageHeader";

export function StaffReportPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <p className="text-sm text-slate-600">
        This report hub will aggregate data from the relevant business domain in a future release.
      </p>
    </div>
  );
}
