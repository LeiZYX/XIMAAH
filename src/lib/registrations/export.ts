type RegistrationRow = {
  studentNameSnapshot: string;
  studentNoSnapshot: string;
  gradeSnapshot: string;
  classNameSnapshot: string;
  status: string;
  lockedAt: Date | null;
  examBoard: { name: string; code: string };
  examSeries: { name: string; year: number };
  subject: { name: string; code: string; qualification: { level: string; name: string } };
  paper: { code: string; title: string };
  examSession: { date: Date; startTime: string | null; endTime: string | null };
  candidate?: { chineseName?: string | null } | null;
};

export function registrationToExportRow(row: RegistrationRow) {
  const sessionDate = row.examSession.date;
  const ampm =
    row.examSession.startTime && Number(row.examSession.startTime.split(":")[0]) >= 12
      ? "PM"
      : row.examSession.startTime
        ? "AM"
        : "";

  const studentName = row.candidate?.chineseName
    ? `${row.studentNameSnapshot}（${row.candidate.chineseName}）`
    : row.studentNameSnapshot;

  return {
    "School student no": row.studentNoSnapshot,
    "Student name（中文姓名）": studentName,
    Grade: row.gradeSnapshot,
    Class: row.classNameSnapshot,
    "Exam series": `${row.examSeries.name} (${row.examSeries.year})`,
    Qualification: `${row.subject.qualification.level} ${row.subject.qualification.name}`,
    Subject: row.subject.name,
    Paper: row.paper.title,
    "Paper code": row.paper.code,
    "Exam date": sessionDate.toISOString().slice(0, 10),
    "Session AM/PM": ampm,
    Status: row.status,
    "Locked at": row.lockedAt?.toISOString() ?? "",
  };
}

export function registrationsToCsv(rows: RegistrationRow[]): string {
  const exportRows = rows.map(registrationToExportRow);
  if (exportRows.length === 0) return "";

  const headers = Object.keys(exportRows[0]);
  const lines = [
    headers.join(","),
    ...exportRows.map((row) =>
      headers
        .map((header) => {
          const value = String(row[header as keyof typeof row] ?? "");
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ];
  return lines.join("\n");
}
