import { CandidateBoardRegistrationsList } from "@/components/post-results/CandidateBoardRegistrationsList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminCandidateBoardRegistrationsPage() {
  return <CandidateBoardRegistrationsList />;
}
