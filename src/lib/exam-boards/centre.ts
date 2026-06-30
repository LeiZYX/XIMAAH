export interface ExamBoardCentreFields {
  centreName?: string | null;
  centreNumber?: string | null;
  centreAddress?: string | null;
  centreEmail?: string | null;
  centrePhone?: string | null;
  centreCountry?: string | null;
  centreTimeZone?: string | null;
  defaultExamOfficerName?: string | null;
  defaultExamOfficerEmail?: string | null;
}

export interface ExamBoardCentreInfo {
  centreName: string;
  centreNumber: string;
  centreAddress: string;
  centreEmail: string;
  centrePhone: string;
  centreCountry: string;
  centreTimeZone: string;
  examOfficerName: string;
  examOfficerEmail: string;
  examBoardName: string;
  examBoardCode: string;
}

function display(value: string | null | undefined, fallback = "—") {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function centreInfoFromExamBoard(
  board: ExamBoardCentreFields & { name: string; code: string; timezone?: string | null },
  options?: { identityCentreNumber?: string | null },
): ExamBoardCentreInfo {
  return {
    centreName: display(board.centreName, board.name),
    centreNumber: display(board.centreNumber ?? options?.identityCentreNumber),
    centreAddress: display(board.centreAddress),
    centreEmail: display(board.centreEmail),
    centrePhone: display(board.centrePhone),
    centreCountry: display(board.centreCountry),
    centreTimeZone: display(board.centreTimeZone ?? board.timezone),
    examOfficerName: display(board.defaultExamOfficerName),
    examOfficerEmail: display(board.defaultExamOfficerEmail),
    examBoardName: board.name,
    examBoardCode: board.code,
  };
}

export function centreInfoLines(info: ExamBoardCentreInfo): string[] {
  const lines = [
    info.centreName,
    `Centre no. ${info.centreNumber} · ${info.examBoardName} (${info.examBoardCode})`,
  ];
  if (info.centreAddress !== "—") lines.push(info.centreAddress);
  const contact: string[] = [];
  if (info.centreEmail !== "—") contact.push(info.centreEmail);
  if (info.centrePhone !== "—") contact.push(info.centrePhone);
  if (contact.length > 0) lines.push(contact.join(" · "));
  if (info.centreCountry !== "—" || info.centreTimeZone !== "—") {
    lines.push(
      [info.centreCountry !== "—" ? info.centreCountry : null, info.centreTimeZone !== "—" ? info.centreTimeZone : null]
        .filter(Boolean)
        .join(" · "),
    );
  }
  if (info.examOfficerName !== "—" || info.examOfficerEmail !== "—") {
    lines.push(
      `Exam Officer: ${info.examOfficerName}${info.examOfficerEmail !== "—" ? ` (${info.examOfficerEmail})` : ""}`,
    );
  }
  return lines.filter(Boolean);
}
