import type { ExamDocumentType } from "@/generated/prisma/enums";
import { candidateDocumentProfile } from "@/lib/candidates/identity";
import { centreInfoFromExamBoard } from "@/lib/exam-boards/centre";
import {
  groupRegistrationsByCandidate,
  groupRegistrationsBySession,
  queryExamDocumentRegistrations,
} from "@/lib/exam-documents/queries";
import {
  formatDuration,
  formatExamDate,
  formatExamSessionLabel,
} from "@/lib/registrations/student-groups";

type RegistrationRow = Awaited<ReturnType<typeof queryExamDocumentRegistrations>>[number];

function boardIdentityForRow(row: RegistrationRow) {
  return (
    row.candidate?.examIdentities.find((identity) => identity.examBoardId === row.examBoardId) ??
    null
  );
}

function centreForRow(row: RegistrationRow) {
  const identity = boardIdentityForRow(row);
  return centreInfoFromExamBoard(row.examBoard, {
    identityCentreNumber: identity?.centreNumber,
  });
}

function mapEntry(row: RegistrationRow) {
  const identity = boardIdentityForRow(row);
  const centre = centreForRow(row);
  return {
    subject: row.subject.name,
    paperCode: row.paper.code,
    paperTitle: row.paper.title,
    date: formatExamDate(
      row.examSession.date instanceof Date
        ? row.examSession.date.toISOString()
        : String(row.examSession.date),
    ),
    time: row.examSession.startTime ?? "—",
    duration: formatDuration(row.paper.duration),
    room: row.examSession.venue ?? "TBC",
    seat: "—",
    examBoard: row.examBoard.name,
    examSession: row.examSeries.name,
    registrationWindow: row.registrationWindow.title,
    centreNumber: centre.centreNumber,
  };
}

export function buildStatementOfEntryPages(rows: RegistrationRow[]) {
  return groupRegistrationsByCandidate(rows).map((group) => {
    const first = group.registrations[0]!;
    const identity = boardIdentityForRow(first);
    const centre = centreForRow(first);
    const profile = candidateDocumentProfile(first);
    return {
      documentTitle: "Statement of Entry",
      centre,
      photoUrl: profile.photoUrl,
      candidateName: profile.displayName,
      chineseName: profile.chineseName,
      studentNumber: profile.studentNumber,
      candidateNumber: profile.candidateNumber,
      uci: identity?.uci ?? "—",
      centreNumber: centre.centreNumber,
      boardCandidateNumber: identity?.boardCandidateNumber ?? "—",
      idDocumentTypeLabel: profile.idDocumentTypeLabel,
      idDocumentNumber: profile.idDocumentNumber,
      genderLabel: profile.genderLabel,
      dateOfBirth: profile.dateOfBirth,
      nationality: profile.nationality,
      grade: profile.grade,
      className: profile.className,
      examBoard: first.examBoard.name,
      examSession: first.examSeries.name,
      registrationWindow: first.registrationWindow.title,
      entries: group.registrations.map(mapEntry),
      instructions:
        "Please check all entries carefully. Report any discrepancies to the Exams Office immediately.",
    };
  });
}

export function buildCandidateTimetablePages(rows: RegistrationRow[]) {
  return groupRegistrationsByCandidate(rows).map((group) => {
    const first = group.registrations[0]!;
    const centre = centreForRow(first);
    const profile = candidateDocumentProfile(first);
    const byDate = new Map<string, ReturnType<typeof mapEntry>[]>();
    for (const row of group.registrations) {
      const entry = mapEntry(row);
      const bucket = byDate.get(entry.date) ?? [];
      bucket.push(entry);
      byDate.set(entry.date, bucket);
    }
    return {
      documentTitle: "Admission Ticket",
      centre,
      photoUrl: profile.photoUrl,
      candidateName: profile.displayName,
      chineseName: profile.chineseName,
      candidateNumber: profile.candidateNumber,
      studentNumber: profile.studentNumber,
      className: profile.className,
      grade: profile.grade,
      idDocumentTypeLabel: profile.idDocumentTypeLabel,
      idDocumentNumber: profile.idDocumentNumber,
      examSession: first.examSeries.name,
      days: [...byDate.entries()].map(([date, entries]) => ({ date, entries })),
    };
  });
}

export function buildAttendanceRegisters(rows: RegistrationRow[]) {
  return groupRegistrationsBySession(rows).map((group) => {
    const first = group.registrations[0]!;
    const centre = centreForRow(first);
    return {
      documentTitle: "Attendance Register",
      centre,
      room: group.session.venue ?? "TBC",
      date: formatExamDate(
        group.session.date instanceof Date
          ? group.session.date.toISOString()
          : String(group.session.date),
      ),
      time: group.session.startTime ?? "—",
      paperCode: group.session.paper.code,
      paperTitle: group.session.paper.title,
      subject: group.session.paper.subject.name,
      sessionLabel: formatExamSessionLabel({
        ...group.session,
        date:
          group.session.date instanceof Date
            ? group.session.date.toISOString()
            : String(group.session.date),
      }),
      rows: group.registrations.map((row, index) => {
        const profile = candidateDocumentProfile(row);
        return {
          seat: String(index + 1),
          candidateNumber: profile.candidateNumber,
          candidateName: profile.displayName,
          className: profile.className,
          photoUrl: profile.photoUrl,
          signature: "",
          present: "",
          absent: "",
          late: "",
          notes: "",
        };
      }),
    };
  });
}

export function buildSeatingPlans(rows: RegistrationRow[]) {
  return groupRegistrationsBySession(rows).map((group) => {
    const first = group.registrations[0]!;
    const centre = centreForRow(first);
    return {
      documentTitle: "Seating Plan",
      centre,
      room: group.session.venue ?? "TBC",
      date: formatExamDate(
        group.session.date instanceof Date
          ? group.session.date.toISOString()
          : String(group.session.date),
      ),
      time: group.session.startTime ?? "—",
      paperCode: group.session.paper.code,
      subject: group.session.paper.subject.name,
      seats: group.registrations.map((row, index) => ({
        seat: String(index + 1),
        candidateNumber: row.assessmentHubCandidateNumberSnapshot ?? "—",
        candidateName: row.studentNameSnapshot,
        paperCode: row.paper.code,
        subject: row.subject.name,
      })),
    };
  });
}

export function buildCandidateListRows(rows: RegistrationRow[]) {
  const groups = groupRegistrationsByCandidate(rows);
  return groups.map((group) => {
    const first = group.registrations[0]!;
    const centre = centreForRow(first);
    return {
      centre,
      candidateNumber: first.assessmentHubCandidateNumberSnapshot ?? "—",
      studentNumber: first.studentNoSnapshot,
      candidateName: first.studentNameSnapshot,
      grade: first.gradeSnapshot,
      className: first.classNameSnapshot,
      centreNumber: centre.centreNumber,
      subjects: [...new Set(group.registrations.map((row) => row.subject.name))].join(", "),
      paperCount: group.registrations.length,
      registrationStatus: first.status,
      registrationType: first.registrationType,
      candidateType: first.candidateTypeSnapshot ?? "INTERNAL",
    };
  });
}

export function buildCandidateLabelPages(rows: RegistrationRow[]) {
  return groupRegistrationsByCandidate(rows).map((group) => {
    const first = group.registrations[0]!;
    const centre = centreForRow(first);
    const profile = candidateDocumentProfile(first);
    return {
      documentTitle: "Candidate Label",
      centre,
      photoUrl: profile.photoUrl,
      candidateName: profile.displayName,
      chineseName: profile.chineseName,
      candidateNumber: profile.candidateNumber,
      studentNumber: profile.studentNumber,
      grade: profile.grade,
      className: profile.className,
      examSession: first.examSeries.name,
    };
  });
}

export function buildDocumentPayload(
  documentType: ExamDocumentType,
  rows: RegistrationRow[],
) {
  switch (documentType) {
    case "STATEMENT_OF_ENTRY":
      return { pages: buildStatementOfEntryPages(rows) };
    case "CANDIDATE_TIMETABLE":
      return { pages: buildCandidateTimetablePages(rows) };
    case "ATTENDANCE_REGISTER":
      return { registers: buildAttendanceRegisters(rows) };
    case "SEATING_PLAN":
      return { plans: buildSeatingPlans(rows) };
    case "CANDIDATE_LIST": {
      const listRows = buildCandidateListRows(rows);
      const centre = listRows[0]?.centre ?? (rows[0] ? centreForRow(rows[0]) : null);
      return { centre, rows: listRows };
    }
    case "CANDIDATE_LABELS":
      return { labels: buildCandidateLabelPages(rows) };
    default:
      return { comingSoon: true, documentType };
  }
}

export function candidateListToCsv(rows: ReturnType<typeof buildCandidateListRows>) {
  const header = [
    "Centre Number",
    "Candidate Number",
    "Student Number",
    "Candidate Name",
    "Grade",
    "Class",
    "Subjects",
    "Paper Count",
    "Status",
    "Registration Type",
    "Candidate Type",
  ];
  const lines = rows.map((row) =>
    [
      row.centreNumber,
      row.candidateNumber,
      row.studentNumber,
      row.candidateName,
      row.grade,
      row.className,
      row.subjects,
      String(row.paperCount),
      row.registrationStatus,
      row.registrationType,
      row.candidateType,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
