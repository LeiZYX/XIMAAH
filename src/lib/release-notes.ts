export const PRODUCT_NAME = "XIMA Assessment Hub";

export interface ReleaseNote {
  version: string;
  releaseDate: string;
  summary: string;
  changes: string[];
  bugFixes?: string[];
  knownIssues?: string[];
}

export const CURRENT_VERSION = "0.4.0";

export const releaseNotes: ReleaseNote[] = [
  {
    version: "0.4.0",
    releaseDate: "2026-06-26",
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
