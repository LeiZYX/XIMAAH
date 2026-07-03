import { redirect } from "next/navigation";

export default function LegacyAdminCandidateNumbersRedirect() {
  redirect("/admin/candidates/board-registration");
}
