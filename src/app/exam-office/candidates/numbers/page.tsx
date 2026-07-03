import { redirect } from "next/navigation";

export default function LegacyExamOfficeCandidateNumbersRedirect() {
  redirect("/exam-office/candidates/board-registration");
}
