import { escapeHtml, renderEmailLayout } from "@/lib/notifications/layout";

export function studentRegistrationsUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/student/registrations`;
}

export function studentFeeStatementsUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/student/fee-statements`;
}

export function formatExamDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatExamTime(startTime?: string | null, endTime?: string | null): string {
  if (!startTime && !endTime) return "Time TBC";
  if (startTime && endTime) return `${startTime}–${endTime}`;
  return startTime || endTime || "Time TBC";
}

export function boardSeriesLabel(params: {
  boardCode: string;
  boardName?: string | null;
  seriesName: string;
  seriesYear: number;
}): string {
  const board = params.boardCode || params.boardName || "Exam board";
  return `${board} ${params.seriesName} ${params.seriesYear}`;
}

export interface ExamRowForEmail {
  subjectCode: string;
  subjectName: string;
  paperCode: string;
  paperTitle: string;
  examDate: Date;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
}

export function renderExamListEmail(params: {
  appUrl: string;
  studentName: string;
  boardSeries: string;
  confirmationNumber?: string | null;
  intro: string;
  exams: ExamRowForEmail[];
}): { subject: string; text: string; html: string } {
  const link = studentRegistrationsUrl(params.appUrl);
  const subject = `${params.boardSeries} — Exam registration confirmed`;

  const lines = params.exams.map((exam) => {
    const when = `${formatExamDate(exam.examDate)} ${formatExamTime(exam.startTime, exam.endTime)}`;
    const venue = exam.venue ? ` · ${exam.venue}` : "";
    return `• ${exam.subjectCode} ${exam.subjectName} — ${exam.paperCode} ${exam.paperTitle} — ${when}${venue}`;
  });

  const text = [
    `Hello ${params.studentName},`,
    "",
    params.intro,
    "",
    params.confirmationNumber ? `Registration number: ${params.confirmationNumber}` : null,
    "",
    "Registered exams:",
    ...lines,
    "",
    `View your registrations: ${link}`,
    "",
    "This is an automated message from XIMA Assessment Hub.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const rowsHtml = params.exams
    .map((exam) => {
      const when = `${formatExamDate(exam.examDate)} ${formatExamTime(exam.startTime, exam.endTime)}`;
      return `<tr>
  <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(exam.subjectCode)} · ${escapeHtml(exam.subjectName)}</td>
  <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(exam.paperCode)} · ${escapeHtml(exam.paperTitle)}</td>
  <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(when)}${exam.venue ? `<br/><span style="color:#64748b;">${escapeHtml(exam.venue)}</span>` : ""}</td>
</tr>`;
    })
    .join("");

  const bodyHtml = `
<p>Hello ${escapeHtml(params.studentName)},</p>
<p>${escapeHtml(params.intro)}</p>
${
  params.confirmationNumber
    ? `<p><strong>Registration number:</strong> ${escapeHtml(params.confirmationNumber)}</p>`
    : ""
}
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
  <thead>
    <tr style="background:#f8fafc;text-align:left;">
      <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Subject</th>
      <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Paper</th>
      <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Date &amp; time</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Open My Exam Registrations</a></p>
<p style="color:#64748b;font-size:13px;">Or visit: ${escapeHtml(link)}</p>
`;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      bodyHtml,
    }),
  };
}

export interface FeeLineForEmail {
  label: string;
  amountLabel: string;
}

export function renderFeeStatementIssuedEmail(params: {
  appUrl: string;
  studentName: string;
  boardSeries: string;
  statementNo: string;
  statusLabel: string;
  totalLabel: string;
  amountDueLabel: string;
  paymentNotes?: string | null;
  lines: FeeLineForEmail[];
}): { subject: string; text: string; html: string } {
  const link = studentFeeStatementsUrl(params.appUrl);
  const subject = `${params.boardSeries} — Exam fee statement`;

  const lineText = params.lines.map((line) => `• ${line.label} — ${line.amountLabel}`);

  const text = [
    `Hello ${params.studentName},`,
    "",
    `Your exam fee statement for ${params.boardSeries} has been issued.`,
    "",
    `Statement: ${params.statementNo}`,
    `Status: ${params.statusLabel}`,
    `Total: ${params.totalLabel}`,
    `Amount due: ${params.amountDueLabel}`,
    params.paymentNotes ? `Notes: ${params.paymentNotes}` : null,
    "",
    "Fee items:",
    ...lineText,
    "",
    `View your fee statements: ${link}`,
    "",
    "This is an automated message from XIMA Assessment Hub.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const rowsHtml = params.lines
    .map(
      (line) => `<tr>
  <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(line.label)}</td>
  <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(line.amountLabel)}</td>
</tr>`,
    )
    .join("");

  const bodyHtml = `
<p>Hello ${escapeHtml(params.studentName)},</p>
<p>Your exam fee statement for <strong>${escapeHtml(params.boardSeries)}</strong> has been issued.</p>
<p>
  <strong>Statement:</strong> ${escapeHtml(params.statementNo)}<br/>
  <strong>Status:</strong> ${escapeHtml(params.statusLabel)}<br/>
  <strong>Total:</strong> ${escapeHtml(params.totalLabel)}<br/>
  <strong>Amount due:</strong> ${escapeHtml(params.amountDueLabel)}
</p>
${params.paymentNotes ? `<p style="color:#475569;">${escapeHtml(params.paymentNotes)}</p>` : ""}
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
  <thead>
    <tr style="background:#f8fafc;text-align:left;">
      <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Item</th>
      <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;text-align:right;">Amount</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Open My Fee Statements</a></p>
<p style="color:#64748b;font-size:13px;">Or visit: ${escapeHtml(link)}</p>
`;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      bodyHtml,
    }),
  };
}
