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
    title: "Overview",
    paragraphs: [
      "XIMA Assessment Hub is the school's exam planning and registration system.",
      "It brings together exam calendars, candidate records, board registration details, and exam registrations in one place.",
      "Students, teachers, and administrators each see the areas relevant to their role.",
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    paragraphs: [
      "After signing in, the Dashboard is your starting point for day-to-day work in the system.",
      "Use the top navigation to move between areas such as Calendar, Candidates, Registrations, and Settings.",
      "Menu items depend on your account role. If you cannot see a page you expect, contact the Exams Office or System Administrator.",
    ],
  },
  {
    id: "calendar",
    title: "Calendar",
    paragraphs: [
      "The Calendar shows upcoming exam sessions and key dates for each exam series.",
      "Browse by date to see when papers are scheduled.",
      "Use filters to narrow results by exam board, qualification, or subject when those options are available.",
      "Teachers and students can use the calendar to plan ahead; administrators use it to confirm session details before registration opens.",
    ],
  },
  {
    id: "students-candidates",
    title: "Students & Candidates",
    paragraphs: [
      "Each student has a candidate profile that holds their personal and school information used for exam administration.",
      "Administrators can search, view, and update candidate profiles, including names, contact details, grade, and class.",
      "Student ID is assigned by the system. School Student Number is the school's own reference where one is used.",
      "Keep candidate profiles accurate before exam registration and board registration work begins.",
    ],
  },
  {
    id: "board-registration",
    title: "Candidate Board Registration",
    paragraphs: [
      "Candidate Board Registration is where exam-board identity details are managed for each student.",
      "A student may have separate records for different examination boards—for example Pearson / Edexcel, AQA, or Cambridge.",
      "For each board identity you can record details such as Centre Number, Candidate Number, and UCI Number where applicable.",
      "These details should be in place before staff create exam registrations for that student and board.",
    ],
  },
  {
    id: "exam-registrations",
    title: "Exam Registrations",
    paragraphs: [
      "Exam Registrations is where authorised staff create and manage entries for exam sessions.",
      "During an open registration period, students may register for themselves where self-registration is enabled.",
      "Teachers and the Exams Office can assist students with registration when needed.",
      "After selecting a student and registration window, choose the exam sessions to enter and review the summary before saving.",
      "Open a registration record at any time to review entered sessions, print confirmation where available, or request changes according to school policy.",
    ],
  },
  {
    id: "import-export",
    title: "Import / Export",
    paragraphs: [
      "Import and export tools help administrators update candidate and board registration data in bulk using Excel.",
    ],
    steps: [
      "Download the Excel template for the type of data you are importing.",
      "Fill in the template using the column headings provided. Do not change or remove required column names.",
      "Choose your completed .xlsx file in the import area (drag and drop or browse).",
      "Review the preview: total rows, new records, updates, validation errors, and duplicate rows.",
      "Commit the import only when the preview shows no blocking errors.",
      "Use Export to download a spreadsheet of current records—for example candidate lists or board registration data—for reporting or offline review.",
    ],
  },
  {
    id: "password-login",
    title: "Password & Login",
    paragraphs: [
      "Sign in with the username or email and password provided by your school.",
      "If you forget your password, use the password reset option on the login page when it is available, or ask the Exams Office for help.",
      "Administrators can assign or reset passwords for student and staff accounts when required.",
      "New accounts may need to be activated before first use. If you cannot sign in, contact the Exams Office or System Administrator.",
      "Change your password after a reset and do not share your login details with anyone else.",
    ],
  },
  {
    id: "backup",
    title: "Backup",
    paragraphs: [
      "System administrators can configure automatic database backups from the admin settings area.",
      "Backups help protect school exam data if recovery is ever needed.",
      "Administrators can set how often backups run and how long backup copies are kept.",
      "Routine backup configuration is an administrator task. Other users do not need to manage backups directly.",
    ],
  },
  {
    id: "support",
    title: "Support",
    paragraphs: [
      "If you need help using XIMA Assessment Hub, contact the Exams Office first for registration, calendar, and candidate questions.",
      "For account access, password issues, or system configuration, contact the System Administrator.",
      "When reporting a problem, include your name, role, the page you were using, and a short description of what happened.",
    ],
  },
];
