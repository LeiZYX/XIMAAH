import { PageHeader } from "@/components/ui/PageHeader";
import { SetupGuideContent } from "@/components/docs/SetupGuideContent";

export default function AdminSetupGuidePage() {
  return (
    <div>
      <PageHeader
        title="Setup guide"
        description="Recommended order for building exam catalogue, sessions, registration, and fees."
      />
      <SetupGuideContent basePath="/admin" />
    </div>
  );
}
