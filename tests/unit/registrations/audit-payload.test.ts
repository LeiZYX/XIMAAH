import { describe, expect, it } from "vitest";
import {
  assertRegistrationAuditReason,
  auditTypeMarker,
  buildRegistrationAuditPayload,
  formatRegistrationAuditNote,
} from "@/lib/registrations/audit-payload";
import { RegistrationError } from "@/lib/registrations/errors";

describe("registration audit payload", () => {
  it("builds a complete payload envelope", () => {
    const payload = buildRegistrationAuditPayload({
      registrationType: "RESTRICTED_INTERNAL",
      registrationNumber: "REG-RI-2026-000001",
      feeStatementNumber: "FS-RI-2026-000001",
      issueNumber: "IC-RI-2026-000001",
      candidateId: "candidate-1",
      candidateType: "INTERNAL",
      visibility: "EXAM_OFFICE_ONLY",
      billingScope: "RESTRICTED_BILLING",
      registrationSource: "EO_FORCED_INTERNAL",
      performedByUserId: "user-1",
      performedByRole: "EXAM_OFFICER",
      reason: "Special arrangement",
      performedAt: "2026-06-26T10:00:00.000Z",
    });

    expect(payload).toMatchObject({
      registrationType: "RESTRICTED_INTERNAL",
      registrationNumber: "REG-RI-2026-000001",
      feeStatementNumber: "FS-RI-2026-000001",
      issueNumber: "IC-RI-2026-000001",
      candidateId: "candidate-1",
      candidateType: "INTERNAL",
      performedByUserId: "user-1",
      reason: "Special arrangement",
    });
  });

  it("marks restricted and external audit notes", () => {
    expect(auditTypeMarker("RESTRICTED_INTERNAL")).toBe("Restricted Internal");
    expect(auditTypeMarker("EXTERNAL")).toBe("External Candidate");
    expect(formatRegistrationAuditNote("EXTERNAL", "9700/12")).toBe(
      "External Candidate · 9700/12",
    );
  });

  it("requires reason for restricted and external add/remove/fee actions", () => {
    expect(() =>
      assertRegistrationAuditReason("RESTRICTED_INTERNAL", "ADD", ""),
    ).toThrow(RegistrationError);
    expect(() =>
      assertRegistrationAuditReason("EXTERNAL", "CANDIDATE_REGISTRATION_FEE_ADDED", null),
    ).toThrow(RegistrationError);
    expect(() =>
      assertRegistrationAuditReason("INTERNAL_NORMAL", "ADD", ""),
    ).not.toThrow();
  });
});
