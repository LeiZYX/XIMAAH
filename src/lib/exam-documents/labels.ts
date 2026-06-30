import type { ExamDocumentType } from "@/generated/prisma/enums";

export function examDocumentTypeLabel(type: ExamDocumentType | string): string {
  switch (type) {
    case "STATEMENT_OF_ENTRY":
      return "Statement of Entry";
    case "CANDIDATE_TIMETABLE":
      return "Admission Ticket";
    case "ATTENDANCE_REGISTER":
      return "Attendance Register";
    case "SEATING_PLAN":
      return "Seating Plan";
    case "DESK_LABELS":
      return "Desk Labels";
    case "CANDIDATE_LABELS":
      return "Candidate Labels";
    case "CANDIDATE_LIST":
      return "Candidate List";
    case "SUBJECT_CANDIDATE_LIST":
      return "Subject Candidate List";
    case "ROOM_CANDIDATE_LIST":
      return "Room Candidate List";
    case "MISSING_CANDIDATE_REPORT":
      return "Missing Candidate Report";
    case "NORMAL_FEE_STATEMENT":
      return "Normal Fee Statement";
    case "RESTRICTED_INVOICE":
      return "Restricted Invoice";
    case "RESULT_SLIP":
      return "Result Slip";
    case "CERTIFICATE_COLLECTION_LIST":
      return "Certificate Collection List";
    default:
      return String(type);
  }
}
