import { PageHeader } from "@/components/ui/PageHeader";
import { SetupGuideContent } from "@/components/docs/SetupGuideContent";

export default function ExamOfficeSetupGuidePage() {
  return (
    <div>
      <PageHeader
        title="Setup guide"
        description="How catalogue, sessions, registration windows, and fees fit together."
      />
      <SetupGuideContent basePath="/exam-office" />
    </div>
  );
}
