import { CandidateBoardRegistrationPanel } from "@/components/candidates/CandidateBoardRegistrationPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExamOfficeCandidateBoardRegistrationPage() {
  return (
    <CandidateBoardRegistrationPanel
      apiPath="/api/exam-office/candidates"
      detailBasePath="/exam-office/candidates"
      moduleBasePath="/exam-office/candidates"
    />
  );
}
