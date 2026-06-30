import type { RegistrationAuditAction } from "@/generated/prisma/enums";

export function auditActionLabel(action: RegistrationAuditAction | string): string {
  switch (action) {
    case "STUDENT_ADD":
    case "ADD":
      return "Student added exam";
    case "STUDENT_REMOVE":
    case "CANCEL":
      return "Student removed exam";
    case "STUDENT_SUBMIT":
    case "SUBMIT":
      return "Student submitted";
    case "SYSTEM_LOCK":
    case "LOCK":
      return "System locked registration";
    case "EO_ADD_AFTER_LOCK":
      return "Exam Officer added exam after lock";
    case "EO_REMOVE_AFTER_LOCK":
      return "Exam Officer removed exam after lock";
    case "EO_REPLACE_AFTER_LOCK":
      return "Exam Officer replaced exam after lock";
    case "ADMIN_ADD_AFTER_LOCK":
      return "Admin added exam after lock";
    case "ADMIN_REMOVE_AFTER_LOCK":
      return "Admin removed exam after lock";
    case "ADMIN_REPLACE_AFTER_LOCK":
      return "Admin replaced exam after lock";
    case "TEACHER_CHANGE_REQUEST":
      return "Teacher change request submitted";
    case "TEACHER_REQUEST_APPROVED":
      return "Teacher change request approved";
    case "TEACHER_REQUEST_REJECTED":
      return "Teacher change request rejected";
    case "TEACHER_LATE_REGISTRATION_REQUEST":
      return "Teacher late registration request submitted";
    case "TEACHER_LATE_REGISTRATION_APPROVED":
      return "Teacher late registration request approved";
    case "TEACHER_LATE_REGISTRATION_REJECTED":
      return "Teacher late registration request rejected";
    case "EO_LATE_REGISTRATION_CREATED":
      return "Exam Officer created late registration";
    case "ADMIN_LATE_REGISTRATION_CREATED":
      return "Admin created late registration";
    case "EO_ASSISTED_REGISTRATION_CREATED":
      return "Exam Officer registered on behalf of student";
    case "ADMIN_ASSISTED_REGISTRATION_CREATED":
      return "Admin registered on behalf of student";
    case "INTERNAL_NORMAL_REGISTRATION_CREATED":
      return "Internal normal registration created";
    case "INTERNAL_NORMAL_REGISTRATION_UPDATED":
      return "Internal normal registration updated";
    case "EO_OFFICE_ONLY_REGISTRATION_CREATED":
      return "Exam Officer created restricted registration (legacy)";
    case "ADMIN_OFFICE_ONLY_REGISTRATION_CREATED":
      return "Admin created restricted registration (legacy)";
    case "EO_RESTRICTED_REGISTRATION_CREATED":
      return "Exam Officer created restricted registration";
    case "ADMIN_RESTRICTED_REGISTRATION_CREATED":
      return "Admin created restricted registration";
    case "RESTRICTED_INTERNAL_REGISTRATION_CREATED":
      return "Restricted internal registration created";
    case "RESTRICTED_INTERNAL_REGISTRATION_UPDATED":
      return "Restricted internal registration updated";
    case "RESTRICTED_REGISTRATION_UPDATED":
      return "Restricted registration updated";
    case "RESTRICTED_REGISTRATION_CANCELLED":
      return "Restricted registration cancelled";
    case "EO_POST_LOCK_ADJUSTMENT":
      return "Exam Officer post-lock adjustment";
    case "ADMIN_POST_LOCK_ADJUSTMENT":
      return "Admin post-lock adjustment";
    case "STUDENT_REGISTRATION_SUBMITTED":
      return "Student submitted registration";
    case "EXTERNAL_CANDIDATE_REGISTRATION_CREATED":
      return "External candidate registration created";
    case "EXTERNAL_REGISTRATION_CREATED":
      return "External candidate registration created";
    case "EXTERNAL_REGISTRATION_UPDATED":
      return "External candidate registration updated";
    case "FEE_STAGE_CREATED":
      return "Fee stage created";
    case "FEE_STAGE_UPDATED":
      return "Fee stage updated";
    case "STUDENT_REGISTRATION_OPENED":
      return "Student registration opened";
    case "STUDENT_REGISTRATION_CLOSED":
      return "Student registration closed";
    case "REGISTRATION_WINDOW_CLOSED":
      return "Registration window closed";
    case "ENTRY_TYPE_DEFAULTED_TO_NORMAL":
      return "Entry type defaulted to Normal";
    case "POST_STUDENT_CLOSE_ADJUSTMENT":
      return "Post-student-close adjustment";
    case "POST_WINDOW_CLOSE_OVERRIDE":
      return "Post-window-close override";
    case "ENTRY_TYPE_AUTO_ASSIGNED":
      return "Entry stage assigned automatically";
    case "ENTRY_TYPE_OVERRIDDEN":
      return "Entry stage overridden by staff";
    case "ADMIN_ADJUST":
      return "Admin adjustment";
    case "CANDIDATE_REGISTRATION_FEE_ADDED":
      return "Candidate Registration Fee added";
    case "CANDIDATE_REGISTRATION_FEE_REMOVED":
      return "Candidate Registration Fee removed";
    case "UPDATE":
      return "Registration updated";
    case "REMOVE":
      return "Exam removed";
    default:
      return String(action);
  }
}
