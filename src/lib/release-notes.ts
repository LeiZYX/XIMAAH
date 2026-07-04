export const PRODUCT_NAME = "XIMA Assessment Hub";

export interface ReleaseNote {
  version: string;
  releaseDate: string;
  summary: string;
  changes: string[];
  bugFixes?: string[];
  knownIssues?: string[];
}

export const CURRENT_VERSION = "1.1.2";

export const releaseNotes: ReleaseNote[] = [
  {
    version: "1.1.2",
    releaseDate: "2026-07-04",
    summary: "Release notes type fix for production build.",
    changes: [],
    bugFixes: [
      "Fixed ReleaseNote TypeScript error blocking production Docker build",
    ],
  },
  {
    version: "1.1.1",
    releaseDate: "2026-07-04",
    summary: "Production build fix for external candidate registration modal.",
    changes: [],
    bugFixes: [
      "Fixed TypeScript build error in ExternalCandidateRegistrationModal after exam-board identity refactor",
    ],
  },
  {
    version: "1.1.0",
    releaseDate: "2026-07-04",
    summary:
      "Teacher late-registration adjustments without subject assignment, optional exam-board identity for staff registration, and audit-log fixes.",
    changes: [
      "Teachers can request late registration adds and removals in one flow; all changes require Exams Office approval",
      "Removed teacher subject-assignment gate from class registrations, change requests, and late registration",
      "Staff-assisted registration no longer blocks when exam-board identity is missing; UI shows a warning instead",
    ],
    bugFixes: [
      "Fixed registration audit log foreign-key error when a registration window auto-closes on teacher page load",
    ],
  },
  {
    version: "1.0.0",
    releaseDate: "2026-07-03",
    summary:
      "Candidate Board Registration, exam-board identity checks during registration, separated student identifiers, Excel import/export, and a user-oriented Help guide.",
    changes: [
      "Added Candidate Board Registration to manage per-board identities (Centre Number, Candidate Number, UCI) for Pearson / Edexcel, AQA, and Cambridge",
      "Exam registrations now load board identity automatically; staff cannot enter board numbers manually during registration",
      "Excel (.xlsx) import with template download, drag-and-drop upload, preview, and commit for board registration data",
      "Separated system Student ID (auto-generated) from School Student Number (school-assigned)",
      "Updated internal student import/export to use Excel templates with preview and validation",
      "Added Exam Board Identities tab on candidate profiles for viewing and editing board records",
      "Rewrote Help page for students, teachers, and administrators without internal billing workflows",
    ],
    knownIssues: [
      "Run pending Prisma migrations through 20260718120000_candidate_exam_identity_redesign after pulling this release.",
    ],
  },
  {
    version: "0.5.0",
    releaseDate: "2026-06-26",
    summary:
      "Restricted and external registration workflows, visibility rules, fee schedules, post-results modules, and calendar board label refinements.",
    changes: [
      "Fixed restricted internal and external candidate registration submit flows with audit log compatibility",
      "Enforced student, teacher, and exam office visibility rules across registration lists and calendars",
      "Added candidate registration fee selection, billing preview, and fee schedule management",
      "Added post-results review windows, cash-in, access-to-script, and certificate request modules",
      "Calendar event cards and board filters now use compact board codes (EDEXCEL, CIE, AQA)",
      "Registration numbering (REG-IN/RI/EX) and enriched registration audit payloads",
    ],
    knownIssues: [
      "Run pending Prisma migrations through 20260713120000_audit_log_billing_scope after pulling this release.",
    ],
  },
  {
    version: "0.4.0",
    releaseDate: "2026-07-05",
    summary:
      "Academic year registration window selector, mobile-friendly student and teacher UI, and About/Help documentation.",
    changes: [
      "Added academic year field and RegistrationWindowSelector across registrations, fees, and exam documents",
      "Registration windows filter by academic year with historical year selection",
      "Mobile-responsive layout for public, student, and teacher pages with collapsible navigation",
      "Calendar defaults to list/agenda view on mobile; exam board filters use short codes (AQA, CIE, Edexcel)",
      "Student fee statements and teacher class registrations use card layouts on small screens",
      "Added About and Help pages for all authenticated roles",
    ],
    knownIssues: [
      "Run Prisma migration 20260705120000_registration_window_academic_year after pulling this release.",
    ],
  },
  {
    version: "0.3.0",
    releaseDate: "2026-06-30",
    summary:
      "Candidate identity profiles, fee statement batch actions, exam documents, and registration workflow enhancements.",
    changes: [
      "Added full internal and external candidate identity fields with photo upload",
      "Added candidate import/export and audit logging for identity changes",
      "Added Exam Documents module (Statement of Entry, Admission Ticket, Attendance Register, Candidate Labels)",
      "Refactored Fee Statements page with batch generate, issue, and print actions",
      "Split registration workspaces by type (Normal, Restricted, External)",
      "Added user management for students and teachers with import/export",
      "Added exam board centre settings and registration window included series",
      "Improved registration window workflow and teacher late registration rules",
      "Added MySQL deployment support and Docker build optimisations",
    ],
    bugFixes: [
      "Fixed fee statement batch issue for existing drafts",
      "Fixed Late Entry fee rule fallback to Normal Entry pricing",
      "Fixed workspace lock backfill for fee statement generation",
    ],
    knownIssues: [
      "Existing candidates may need identity fields completed before saving profile updates.",
      "Run pending Prisma migrations after pulling this release.",
    ],
  },
  {
    version: "0.2.0",
    releaseDate: "2026-06-15",
    summary: "Initial Assessment Hub with registration workflow and fee management foundations.",
    changes: [
      "Registration windows with student and staff registration periods",
      "Internal student self-registration and staff-assisted registration",
      "Fee rules, exchange rates, and fee statement generation",
      "Assessment calendar and key dates",
    ],
  },
];

export function getSystemInfo() {
  const latest = releaseNotes[0];
  return {
    productName: PRODUCT_NAME,
    version: CURRENT_VERSION,
    releaseDate: latest?.releaseDate ?? "—",
    environment:
      process.env.APP_ENV ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV ??
      "development",
    buildCommit: (
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_BUILD_COMMIT ??
      "local"
    ).slice(0, 7),
  };
}
