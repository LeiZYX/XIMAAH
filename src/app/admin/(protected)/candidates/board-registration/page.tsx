import { CandidateBoardRegistrationPanel } from "@/components/candidates/CandidateBoardRegistrationPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminCandidateBoardRegistrationPage() {
  return (
    <CandidateBoardRegistrationPanel
      apiPath="/api/admin/candidates"
      detailBasePath="/admin/candidates"
      moduleBasePath="/admin/candidates"
    />
  );
}
