import * as XLSX from "xlsx";
import type { FeeDetailRow, FeeSummaryRow } from "@/lib/fees/reporting";

function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportSummaryCsv(rows: FeeSummaryRow[]): string {
  const headers = [
    "Registration Window",
    "Exam Board",
    "Exam Series",
    "Year",
    "Grade",
    "Class",
    "Candidate Type",
    "Subject",
    "Candidate Count",
    "Exam Entry Count",
    "Total GBP",
    "Total CNY",
    "Missing Fee Rules",
    "Statement Count",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.registrationWindowTitle,
        row.examBoardName,
        row.examSeriesName,
        row.examSeriesYear,
        row.grade,
        row.className,
        row.candidateType,
        row.subjectName,
        row.candidateCount,
        row.examEntryCount,
        row.totalGbp,
        row.totalCny,
        row.missingFeeRuleCount,
        row.statementCount,
      ]
        .map(escapeCsv)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

export function exportDetailsCsv(rows: FeeDetailRow[], showCosts: boolean): string {
  const headers = [
    "Statement No.",
    "Candidate Name",
    "AH Candidate No.",
    "Student No.",
    "Candidate Type",
    "Grade",
    "Class",
    "Registration Source",
    "Visibility",
    "Billing Scope",
    "Exam Board",
    "Exam Series",
    "Subject",
    "Paper Code",
    "Paper Title",
    "Entry Type",
    "Exam Date",
    ...(showCosts ? ["Cost Currency", "Cost Amount", "Markup Type", "Markup Value"] : []),
    "Exchange Rate",
    "Sales GBP",
    "Sales CNY",
    "Statement Status",
    "Generated At",
    "Registration Window",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.statementNo ?? "",
        row.candidateName,
        row.assessmentHubCandidateNumber ?? "",
        row.studentNumber ?? "",
        row.candidateType ?? "",
        row.grade,
        row.className,
        row.registrationSource ?? "",
        row.visibility ?? "",
        row.billingScope ?? "",
        row.examBoardName,
        row.examSeriesName,
        row.subjectName,
        row.paperCode,
        row.paperTitle,
        row.entryType,
        row.examDate ?? "",
        ...(showCosts
          ? [row.costCurrency ?? "", row.costAmount ?? "", row.markupType ?? "", row.markupValue ?? ""]
          : []),
        row.exchangeRate ?? "",
        row.salesGbp,
        row.salesCny,
        row.statementStatus,
        row.generatedAt ?? "",
        row.registrationWindowTitle,
      ]
        .map(escapeCsv)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

export function exportSummaryXlsx(rows: FeeSummaryRow[]): Buffer {
  const data = rows.map((row) => ({
    "Registration Window": row.registrationWindowTitle,
    "Exam Board": row.examBoardName,
    "Exam Series": row.examSeriesName,
    Year: row.examSeriesYear,
    Grade: row.grade,
    Class: row.className,
    "Candidate Type": row.candidateType,
    Subject: row.subjectName,
    "Candidate Count": row.candidateCount,
    "Exam Entry Count": row.examEntryCount,
    "Total GBP": row.totalGbp,
    "Total CNY": row.totalCny,
    "Missing Fee Rules": row.missingFeeRuleCount,
    "Statement Count": row.statementCount,
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Fee Summary");
  return Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
}

export function exportDetailsXlsx(rows: FeeDetailRow[], showCosts: boolean): Buffer {
  const data = rows.map((row) => {
    const base: Record<string, unknown> = {
      "Statement No.": row.statementNo ?? "",
      "Candidate Name": row.candidateName,
      "AH Candidate No.": row.assessmentHubCandidateNumber ?? "",
      "Student No.": row.studentNumber ?? "",
      "Candidate Type": row.candidateType ?? "",
      Grade: row.grade,
      Class: row.className,
      "Registration Source": row.registrationSource ?? "",
      Visibility: row.visibility ?? "",
      "Billing Scope": row.billingScope ?? "",
      "Exam Board": row.examBoardName,
      "Exam Series": row.examSeriesName,
      Subject: row.subjectName,
      "Paper Code": row.paperCode,
      "Paper Title": row.paperTitle,
      "Entry Type": row.entryType,
      "Exam Date": row.examDate ?? "",
    };
    if (showCosts) {
      base["Cost Currency"] = row.costCurrency ?? "";
      base["Cost Amount"] = row.costAmount ?? "";
      base["Markup Type"] = row.markupType ?? "";
      base["Markup Value"] = row.markupValue ?? "";
    }
    base["Exchange Rate"] = row.exchangeRate ?? "";
    base["Sales GBP"] = row.salesGbp;
    base["Sales CNY"] = row.salesCny;
    base["Statement Status"] = row.statementStatus;
    base["Generated At"] = row.generatedAt ?? "";
    base["Registration Window"] = row.registrationWindowTitle;
    return base;
  });
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Fee Details");
  return Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
}
