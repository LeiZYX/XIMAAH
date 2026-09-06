export const PRODUCT_NAME = "XIMA Assessment Hub";

export interface ReleaseNote {
  version: string;
  releaseDate: string;
  summary: string;
  changes: string[];
  bugFixes?: string[];
  knownIssues?: string[];
}

export const CURRENT_VERSION = "1.3.2";

export const releaseNotes: ReleaseNote[] = [
  {
    version: "1.3.2",
    releaseDate: "2026-09-06",
    summary: "Exam Documents: Desk Labels preview and print for exam room seating.",
    changes: [
      "Exam Room Documents → Desk Labels: printable seat cards with name, Cand No, UCI, paper, room, and time (seat order matches Seating Plan)",
      "Candidate Labels print is enabled (removed from coming-soon block)",
    ],
  },
  {
    version: "1.3.1",
    releaseDate: "2026-09-06",
    summary:
      "One-shot External candidate CSV import with profile fields plus UCI and board Candidate Number.",
    changes: [
      "Candidates → Import / Export: External rows (candidateType=EXTERNAL) create or update the person and Board identity in one CSV",
      "Supports chineseName, surname/given pinyin (or first/last name), gender, DOB, ID, examBoard, centreNumber, uci, boardCandidateNumber, and friendly header aliases",
      "Download External sample CSV from the import page; re-import matches by externalId, Assessment Hub number, or ID/passport",
    ],
  },
  {
    version: "1.3.0",
    releaseDate: "2026-09-05",
    summary:
      "Edexcel Internal: auto provisional UCI on registration, Candidate Registration Fee rules, and UCI on My Exam Registrations cards.",
    changes: [
      "Internal Edexcel registration: if UCI is empty, allocate Centre + B + school student number last 6 digits",
      "Candidate Registration Fee is required when UCI is empty or does not end with a letter (imported provisional numbers keep their UCI and still incur the fee)",
      "Fee (and system-allocated UCI) can be cleared only after all subjects are removed, UCI started empty, and Bulk Entries baseline has not been submitted",
      "My Exam Registrations cards show UCI Number and Registration item when the fee applies",
    ],
  },
  {
    version: "1.2.9",
    releaseDate: "2026-09-05",
    summary:
      "Student late exam adjustments with form-teacher routing, same-grade assist review, and staff email notifications.",
    changes: [
      "Registration window General: enable student late adjustment requests and set a request deadline between student close and final close",
      "My Exam Registrations: locked cards offer Request adjustment (fee warning, draft add/remove with reasons, one-time submit). Submit requires a configured class form teacher (班主任)",
      "Class form teachers (Admin Users / Exam Office): assign one form teacher per grade+class; same-grade form teachers may assist review",
      "Teacher Class Registrations and EO/Admin Registrations: approve or reject with a required reason (form teacher → EO; EO apply reuses post-lock adjustment and fee statement regeneration)",
      "After teacher review: optional email To student, Cc EO and other same-grade form teachers (Password & Email Settings → Staff notifications)",
      "Locked registration confirmation print includes student and parent/guardian signature lines",
    ],
  },
  {
    version: "1.2.8",
    releaseDate: "2026-09-04",
    summary:
      "Student Overview by type and grade, safer Active registration windows, and editable Normal fee-stage end.",
    changes: [
      "Candidates → Student Overview (Admin and Exam Office): Internal/External switch, total and per-grade counts, drill-down list with school number, name, DOB, gender, UCI, and school",
      "Calendar prefers an Active registration window when the same board/series also appears on a Closed window; staff alert when two Active windows share a series",
      "Fee Stages: Normal Entry end date is editable and must be on or after Student registration close (start still follows Student registration open)",
      "Exam series delete is blocked when sessions, registration windows, or other linked records still use the series",
    ],
  },
  {
    version: "1.2.7",
    releaseDate: "2026-09-04",
    summary:
      "Clearer fee-rule setup by series subject, setup guide, and searchable paper picker.",
    changes: [
      "Registration window Fees: one row per series subject with editable Normal / Late / High Late cost and sales; defaults sync from exam sessions (cost/sales £0)",
      "Pricing formula defaults (Late = Normal × 2, High Late × 3, sales = cost + 20%) with Apply formula per row or all rows; each row remains freely editable",
      "Fee rules Excel export/import uses the same one-subject-per-row layout (Normal/Late/High Late cost & sales); legacy entryType sheets still import",
      "Setup guide page (Admin and Exam Office): Structure Board → Qualification → Subject → Paper; Time Series → Sessions; Operations Calendar Subjects → Registration Window → Fees",
      "Admin Dashboard links to the setup guide; Exam Sessions Add/Edit Paper field supports fuzzy search by code, title, or subject",
      "IAL bulk-entries UCI import script writes Pearson Edexcel board identities as REGISTERED with registeredAt = now",
    ],
  },
  {
    version: "1.2.6",
    releaseDate: "2026-09-03",
    summary:
      "Email students when locked registrations change and when fee statements are paid.",
    changes: [
      "After post-lock add/remove/replace, internal students receive a Registration updated email with change summary, current exam list, and a link to My Exam Registrations",
      "After a successful online payment marks a normal fee statement Paid, students receive a Fee statement paid email with a link to My Fee Statements",
      "Password & Email Settings: Registration updated and Fee statement paid toggles are now active (still behind the master student-notifications switch)",
      "Issue-as-paid fee statements still send only the issued email; a separate paid email is not duplicated",
    ],
    knownIssues: [
      "Run Prisma migration 20260903080000_student_notification_updated_paid after pulling this release.",
    ],
  },
  {
    version: "1.2.5",
    releaseDate: "2026-09-03",
    summary:
      "Admin can enable or disable internal-student email notifications without affecting password reset.",
    changes: [
      "Password & Email Settings: new Student email notifications section with master switch plus Registration locked / Fee statement issued toggles",
      "Student notification emails only send when the master switch and the matching type toggle are on; password reset and SMTP test email are unchanged",
      "Default master switch is off so production must explicitly enable notifications after SMTP is configured",
    ],
    knownIssues: [
      "Run Prisma migration 20260903070000_student_notification_toggles after pulling this release.",
    ],
  },
  {
    version: "1.2.4",
    releaseDate: "2026-09-03",
    summary:
      "Email internal students when registrations lock and when fee statements are issued.",
    changes: [
      "When a registration window locks, internal students receive a noreply email listing their confirmed exams (subject, paper, date/time) with a link to My Exam Registrations",
      "When Exam Office or Admin issues a normal fee statement, the student receives a noreply email with fee line items and a link to My Fee Statements",
      "Uses the existing Aliyun Mail / SMTP settings (Password & Email Settings); restricted and external registrations are not emailed",
      "Delivery is logged for idempotency so lock and issue emails are not re-sent repeatedly",
    ],
    knownIssues: [
      "Run Prisma migration 20260903060000_student_notification_log after pulling this release.",
      "SMTP must be configured (host, from, user, password) or emails are skipped and recorded as SKIPPED.",
      "Post-lock add/remove emails and payment-received emails are planned for a later release.",
    ],
  },
  {
    version: "1.2.3",
    releaseDate: "2026-08-30",
    summary:
      "Choose fee stage when adding exams after a closed window; fix regenerate statement FK error.",
    changes: [
      "Help student register after deadline and post-lock add: select Normal, Late, or High Late when the window is closed (required) or override automatically timed stages",
      "Fix Regenerate Revised Statement foreign-key error after add-then-remove exam changes",
    ],
  },
  {
    version: "1.2.2",
    releaseDate: "2026-08-30",
    summary: "Student fee payment page auto-refreshes after online pay.",
    changes: [
      "While a WeChat/Alipay QR is awaiting payment, the page polls GlobePay so status flips to Paid without tapping Refresh",
    ],
  },
  {
    version: "1.2.1",
    releaseDate: "2026-08-30",
    summary:
      "Staff can help students who never registered after a window closes.",
    changes: [
      "Add Registration menu: Help student register after deadline (Admin and Exam Office)—select any student for Open or Closed windows when post-lock is enabled",
    ],
  },
  {
    version: "1.2.0",
    releaseDate: "2026-08-29",
    summary:
      "Online fee payment (GlobePay GBP QR), balance due after revised statements, and clearer Help on registration and payment timing.",
    changes: [
      "Students can pay issued fee statements online in GBP via WeChat Pay or Alipay QR (GlobePay)",
      "Exam Officers can view payment status, cancel unpaid orders, and filter unpaid/paid statements",
      "Revised fee statements after a successful payment charge only the balance due; unpaid revisions still charge the full total; zero balance marks Paid automatically",
      "Fee statement and print views show already paid and amount due when a top-up applies",
      "Help page: registration timeline (student / teacher / Exams Office) and fees, statements & payment guidance",
    ],
    bugFixes: [
      "Fixed fee-statements include typing that blocked the production Docker build",
      "Simplified student payment UI labels (Refresh; no CNY reference on online pay)",
    ],
    knownIssues: [
      "Run Prisma migration 20260829113000_fee_statement_amount_due after pulling this release (if not already applied).",
      "GlobePay credentials (GLOBEPAY_*) must be set in the production .env; notify URL must be reachable over HTTPS.",
    ],
  },
  {
    version: "1.1.2",
    releaseDate: "2026-07-04",
    summary: "Release notes type fix for production build.",
    changes: [],
    bugFixes: [
      "Fixed ReleaseNote TypeScript error blocking production build",
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
