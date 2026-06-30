import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import type { ExamDocumentType } from "@/generated/prisma/enums";
import { buildDocumentPayload, candidateListToCsv } from "@/lib/exam-documents/builders";
import { createExamDocumentAuditLog } from "@/lib/exam-documents/audit";
import {
  IMPLEMENTED_DOCUMENT_TYPES,
  parseExamDocumentFilters,
  queryExamDocumentRegistrations,
} from "@/lib/exam-documents/queries";
import { generateRestrictedInvoice } from "@/lib/fees/restricted-invoice";

const COMING_SOON_TYPES = new Set<ExamDocumentType>([
  "DESK_LABELS",
  "CANDIDATE_LABELS",
  "SUBJECT_CANDIDATE_LIST",
  "ROOM_CANDIDATE_LIST",
  "MISSING_CANDIDATE_REPORT",
  "NORMAL_FEE_STATEMENT",
  "RESULT_SLIP",
  "CERTIFICATE_COLLECTION_LIST",
]);

export async function handleExamDocumentsGet(request: NextRequest) {
  const documentType = request.nextUrl.searchParams.get("documentType") as ExamDocumentType | null;
  if (!documentType) return jsonError("documentType is required", 400);

  if (!IMPLEMENTED_DOCUMENT_TYPES.includes(documentType as never) && COMING_SOON_TYPES.has(documentType)) {
    return NextResponse.json({ comingSoon: true, documentType });
  }

  const filters = parseExamDocumentFilters(request.nextUrl.searchParams);
  const restrictedOnly = documentType === "RESTRICTED_INVOICE";
  const rows = await queryExamDocumentRegistrations(filters, { restrictedOnly });

  if (documentType === "RESTRICTED_INVOICE") {
    const workspaces = [...new Set(rows.map((row) => row.registrationWorkspaceId).filter(Boolean))];
    return NextResponse.json({
      documentType,
      workspaceCount: workspaces.length,
      registrationCount: rows.length,
      workspaces,
    });
  }

  const payload = buildDocumentPayload(documentType, rows);
  return NextResponse.json({
    documentType,
    filters,
    registrationCount: rows.length,
    ...payload,
  });
}

export async function handleExamDocumentsPost(
  request: NextRequest,
  performedById: string,
  action: "preview" | "print" | "download",
) {
  const body = await request.json();
  const documentType = body.documentType as ExamDocumentType | undefined;
  if (!documentType) return jsonError("documentType is required", 400);

  if (COMING_SOON_TYPES.has(documentType) && documentType !== "NORMAL_FEE_STATEMENT") {
    return jsonError("This document type is not implemented yet", 501);
  }

  const filters = parseExamDocumentFilters(new URLSearchParams(body.filters ?? {}));
  const restrictedOnly = documentType === "RESTRICTED_INVOICE";
  const rows = await queryExamDocumentRegistrations(filters, { restrictedOnly });

  if (documentType === "RESTRICTED_INVOICE") {
    const workspaceId = body.workspaceId as string | undefined;
    if (!workspaceId) return jsonError("workspaceId is required for restricted invoice", 400);
    const invoice = await generateRestrictedInvoice({
      workspaceId,
      generatedByUserId: performedById,
      issue: action !== "preview",
    });
    await createExamDocumentAuditLog({
      action:
        action === "download"
          ? "RESTRICTED_INVOICE_DOWNLOADED"
          : action === "print"
            ? "RESTRICTED_INVOICE_PRINTED"
            : "EXAM_DOCUMENT_PREVIEWED",
      performedById,
      documentType,
      registrationWindowId: invoice.registrationWindowId,
      candidateId: invoice.candidateId,
      metadata: { filters, statementNo: invoice.statementNo, action },
    });
    return NextResponse.json({ documentType, invoice, action });
  }

  const payload = buildDocumentPayload(documentType, rows);
  const auditAction =
    action === "download"
      ? "EXAM_DOCUMENT_DOWNLOADED"
      : action === "print"
        ? documentType === "STATEMENT_OF_ENTRY"
          ? "STATEMENT_OF_ENTRY_PRINTED"
          : documentType === "ATTENDANCE_REGISTER"
            ? "ATTENDANCE_REGISTER_PRINTED"
            : documentType === "SEATING_PLAN"
              ? "SEATING_PLAN_PRINTED"
              : documentType === "CANDIDATE_LIST"
                ? "CANDIDATE_LIST_EXPORTED"
                : "EXAM_DOCUMENT_PRINTED"
        : "EXAM_DOCUMENT_PREVIEWED";

  await createExamDocumentAuditLog({
    action: auditAction,
    performedById,
    documentType,
    registrationWindowId: filters.registrationWindowId ?? null,
    examSessionId: filters.examSessionId ?? null,
    candidateCount: rows.length,
    metadata: { filters, action },
  });

  if (action === "download" && documentType === "CANDIDATE_LIST" && "rows" in payload) {
    const csv = candidateListToCsv(payload.rows as never);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="candidate-list.csv"',
      },
    });
  }

  return NextResponse.json({ documentType, action, registrationCount: rows.length, ...payload });
}
