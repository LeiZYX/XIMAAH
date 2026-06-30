"use client";

import { Card } from "@/components/ui/Card";
import { FeeStatementsBatchPanel } from "@/components/fees/FeeStatementsBatchPanel";
import { CandidateInvoicesBatchPanel } from "@/components/fees/CandidateInvoicesBatchPanel";
import type { StaffRegistrationTypeFilter } from "@/lib/registrations/workspace-type-filters";

interface FeeStatementsBatchWidgetProps {
  registrationWindowId: string;
  statementType: StaffRegistrationTypeFilter;
  windowsBasePath: string;
}

export function FeeStatementsBatchWidget({
  registrationWindowId,
  statementType,
  windowsBasePath,
}: FeeStatementsBatchWidgetProps) {
  if (!registrationWindowId) return null;

  const feeRulesHref = `${windowsBasePath}/${registrationWindowId}/fees`;

  if (statementType === "INTERNAL_NORMAL") {
    return (
      <FeeStatementsBatchPanel
        registrationWindowId={registrationWindowId}
        feeRulesHref={feeRulesHref}
      />
    );
  }

  if (statementType === "RESTRICTED_INTERNAL") {
    return (
      <CandidateInvoicesBatchPanel
        registrationWindowId={registrationWindowId}
        feeRulesHref={feeRulesHref}
        statementKind="RESTRICTED"
        batchAction="batch-restricted"
        title="Restricted fee statements"
        description="Generate restricted fee statements (FS-RI) for office-only restricted registrations."
        candidateColumnLabel="Student"
        itemLabel="invoices"
      />
    );
  }

  return (
    <CandidateInvoicesBatchPanel
      registrationWindowId={registrationWindowId}
      feeRulesHref={feeRulesHref}
      statementKind="EXTERNAL"
      batchAction="batch-external"
      title="External candidate fee statements"
      description="Generate external candidate fee statements (FS-EX). Exam documents are managed separately under Exam Documents."
      candidateColumnLabel="Candidate"
      itemLabel="invoices"
    />
  );
}
