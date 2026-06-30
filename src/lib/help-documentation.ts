export interface HelpSection {
  id: string;
  title: string;
  paragraphs?: string[];
  steps?: string[];
  bullets?: string[];
}

export const helpSections: HelpSection[] = [
  {
    id: "overview",
    title: "What is XIMA Assessment Hub?",
    paragraphs: [
      "XIMA Assessment Hub is the school's exam registration and planning system.",
      "It is used to view exam calendars, register for exams, check registration status, and view fee statements when they are published.",
      "Students, teachers, and exam office staff all use the same calendar and registration window information, with access tailored to each role.",
    ],
  },
  {
    id: "student-workflow",
    title: "Student exam registration workflow",
    paragraphs: ["Follow these steps to register for exams during an open registration window:"],
    steps: [
      "Log in with your student account.",
      "Open My Exam Registrations from the top navigation.",
      "Choose an active registration window for your exam series.",
      "Select the subjects and papers you need to enter.",
      "Review your entries carefully, then submit your registration.",
      "Return to My Exam Registrations to check your current status.",
      "View your fee statement later if one has been published for your registration.",
    ],
  },
  {
    id: "windows-deadlines",
    title: "Registration window and deadlines",
    paragraphs: [
      "Each registration window has a student registration period with a clear open and close time.",
      "While the student registration period is open, you may submit a new registration or adjust your own subject and paper choices.",
      "After the student registration close deadline, your registration becomes locked.",
      "Once locked, you cannot directly add, remove, or change exams in the system.",
      "If you need a change after lock, contact the relevant subject teacher as soon as possible.",
    ],
  },
  {
    id: "teacher-changes",
    title: "Teacher-assisted changes after lock",
    paragraphs: [
      "When a registration is locked, changes must go through a formal review process:",
    ],
    steps: [
      "The student contacts the subject teacher and explains the requested change.",
      "The teacher reviews whether the request is appropriate.",
      "The teacher submits a change request in the system on the student's behalf.",
      "The Exam Officer reviews the request.",
      "The change only becomes effective after Exam Officer approval.",
    ],
  },
  {
    id: "eo-approval",
    title: "Exam Officer approval",
    paragraphs: [
      "The Exam Officer may approve or reject teacher-submitted change requests.",
      "Approved requests update the student's registration record and may affect fee statements if billing has already started.",
      "Rejected requests do not change the registration. The teacher and student should be informed of the outcome.",
    ],
  },
  {
    id: "fee-statements",
    title: "Fee statements",
    paragraphs: [
      "Students may view normal fee statements for their visible exam registrations when statements have been published.",
      "A fee statement lists the exam entries that will be billed for that registration window.",
      "If your registration changes after a statement was issued, contact the Exams Office for guidance.",
      "Fee statements are read-only for students. Payment arrangements are handled outside this system.",
    ],
  },
  {
    id: "reminders",
    title: "Important reminders",
    bullets: [
      "Check your exam entries carefully before the student registration deadline.",
      "Missing the deadline may lead to late entry fees or prevent changes without teacher assistance.",
      "Once your registration is locked, changes require teacher submission and Exam Officer approval.",
      "Always verify exam dates, session times, venues, and paper codes before the deadline.",
      "Keep your contact details up to date so staff can reach you about registration issues.",
    ],
  },
];

export const roleHelpNotes: Record<
  "STUDENT" | "SUBJECT_TEACHER" | "EXAM_OFFICER" | "ADMIN",
  { title: string; bullets: string[] }
> = {
  STUDENT: {
    title: "Notes for students",
    bullets: [
      "Use My Exam Registrations to submit and review your entries.",
      "Locked means you can no longer edit directly — contact your subject teacher for help.",
      "For urgent registration questions, speak to your subject teacher first, then the Exams Office if needed.",
    ],
  },
  SUBJECT_TEACHER: {
    title: "Notes for teachers",
    bullets: [
      "Monitor class registrations during the open student registration period.",
      "After lock, submit change requests only when a student has asked for a legitimate adjustment.",
      "Include a clear reason when submitting a change request so the Exam Officer can review it quickly.",
    ],
  },
  EXAM_OFFICER: {
    title: "Notes for Exam Officers",
    bullets: [
      "Review pending teacher change requests promptly during the registration window.",
      "Approve only requests that meet school and exam board policy.",
      "Use registration reports and fee tools to confirm entries before statements are issued.",
    ],
  },
  ADMIN: {
    title: "Notes for administrators",
    bullets: [
      "Configure registration windows, calendars, and user access before each exam season.",
      "Ensure teachers and students can see the correct open windows and deadlines.",
      "Use the same Help workflow descriptions when training staff and students.",
    ],
  },
};
