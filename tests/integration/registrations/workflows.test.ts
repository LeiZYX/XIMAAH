import { describe, expect, it, afterAll } from "vitest";
import { disconnectPrismaClient, prisma } from "@/lib/prisma";
import { createRegistrationAuditLog } from "@/lib/registrations/audit";
import { RegistrationError } from "@/lib/registrations/errors";
import { createStudentRegistration } from "@/lib/registrations/service";
import { applyLockedRegistrationAdjustment } from "@/lib/registrations/locked-registration-adjustment";
import {
  applyAssistedRegistration,
  applyExternalCandidateRegistration,
  applyOfficeOnlyInternalRegistration,
} from "@/lib/registrations/workflows";
import { testIds } from "../../fixtures/manifest";

describe.sequential("registration workflows integration", () => {
  it("assigns STUDENT_SUBMITTED source for student registration", async () => {
    const registration = await createStudentRegistration(
      testIds.studentInternal,
      testIds.sessionOpen,
    );
    expect(registration.registrationSource).toBe("STUDENT_SUBMITTED");
    expect(registration.visibility).toBe("STUDENT_AND_TEACHER");
    expect(registration.candidateTypeSnapshot).toBe("INTERNAL");
  });

  it("assigns EO_ASSISTED source for assisted registration", async () => {
    const workspace = await applyAssistedRegistration(
      { id: testIds.examOfficer, role: "EXAM_OFFICER" },
      {
        studentId: testIds.studentAssisted,
        registrationWindowId: testIds.windowOpen,
        examSessionIds: [testIds.sessionOpen],
        reason: "Integration assisted registration",
      },
    );
    expect(workspace.registrationSource).toBe("EO_ASSISTED");
    expect(workspace.visibility).toBe("STUDENT_AND_TEACHER");
    expect(workspace.billingScope).toBe("NORMAL_BILLING");
    expect(workspace.registrationType).toBe("INTERNAL_NORMAL");
    expect(workspace.visibleToStudent).toBe(true);
    expect(workspace.visibleToTeacher).toBe(true);
    expect(workspace.registrationNumber).toMatch(/^REG-IN-\d{4}-\d{6}$/);

    const workspaceAudit = await prisma.registrationAuditLog.findFirst({
      where: {
        registrationWorkspaceId: workspace.id,
        action: "EO_ASSISTED_REGISTRATION_CREATED",
      },
    });
    expect(workspaceAudit).not.toBeNull();
    expect(workspaceAudit?.registrationSource).toBe("EO_ASSISTED");
  });

  it("assigns office-only visibility for forced internal registration", async () => {
    const workspace = await applyOfficeOnlyInternalRegistration(
      { id: testIds.examOfficer, role: "EXAM_OFFICER" },
      {
        studentId: testIds.studentAssisted,
        registrationWindowId: testIds.windowOpen,
        examSessionIds: [testIds.sessionOfficeOnly],
        reason: "Integration office-only registration",
      },
    );
    expect(workspace.registrationSource).toBe("EO_FORCED_INTERNAL");
    expect(workspace.visibility).toBe("EXAM_OFFICE_ONLY");
    expect(workspace.billingScope).toBe("RESTRICTED_BILLING");
    expect(workspace.registrationType).toBe("RESTRICTED_INTERNAL");
    expect(workspace.visibleToStudent).toBe(false);
    expect(workspace.visibleToTeacher).toBe(false);
    expect(workspace.restrictedReason).toBe("Integration office-only registration");
    expect(workspace.registrationNumber).toMatch(/^REG-RI-\d{4}-\d{6}$/);

    const workspaceAudit = await prisma.registrationAuditLog.findFirst({
      where: {
        registrationWorkspaceId: workspace.id,
        action: "RESTRICTED_INTERNAL_REGISTRATION_CREATED",
      },
    });
    expect(workspaceAudit).not.toBeNull();
    expect(workspaceAudit?.reason).toBe("Integration office-only registration");
    expect(workspaceAudit?.note).toContain("Restricted Internal");
    expect(workspaceAudit?.registrationType).toBe("RESTRICTED_INTERNAL");
    expect(workspaceAudit?.registrationNumber).toMatch(/^REG-RI-/);

    const normalWorkspace = await prisma.registrationWorkspace.findFirst({
      where: {
        studentId: testIds.studentAssisted,
        registrationWindowId: testIds.windowOpen,
        registrationType: "INTERNAL_NORMAL",
      },
    });
    const restrictedWorkspace = await prisma.registrationWorkspace.findFirst({
      where: {
        studentId: testIds.studentAssisted,
        registrationWindowId: testIds.windowOpen,
        registrationType: "RESTRICTED_INTERNAL",
      },
    });
    expect(normalWorkspace).not.toBeNull();
    expect(restrictedWorkspace).not.toBeNull();
    expect(normalWorkspace!.id).not.toBe(restrictedWorkspace!.id);
  });

  it("assigns EXTERNAL_CANDIDATE source for external registration", async () => {
    const workspace = await applyExternalCandidateRegistration(
      { id: testIds.examOfficer, role: "EXAM_OFFICER" },
      {
        candidateId: testIds.candidateExternal,
        registrationWindowId: testIds.windowOpen,
        examSessionIds: [testIds.sessionOpen],
        reason: "Integration external registration",
      },
    );
    expect(workspace.registrationSource).toBe("EXTERNAL_CANDIDATE");
    expect(workspace.visibility).toBe("EXAM_OFFICE_ONLY");
    expect(workspace.billingScope).toBe("EXTERNAL_BILLING");
    expect(workspace.registrationType).toBe("EXTERNAL");
    expect(workspace.visibleToStudent).toBe(false);
    expect(workspace.visibleToTeacher).toBe(false);
    expect(workspace.registrationNumber).toMatch(/^REG-EX-\d{4}-\d{6}$/);

    const workspaceAudit = await prisma.registrationAuditLog.findFirst({
      where: {
        registrationWorkspaceId: workspace.id,
        action: "EXTERNAL_REGISTRATION_CREATED",
      },
    });
    expect(workspaceAudit).not.toBeNull();
    expect(workspaceAudit?.note).toContain("External Candidate");
    expect(workspaceAudit?.registrationType).toBe("EXTERNAL");
    expect(workspaceAudit?.reason).toBe("Integration external registration");
  });

  it("merges post-lock adjustments into the existing internal normal workspace", async () => {
    const before = await prisma.registrationWorkspace.findUnique({
      where: { id: testIds.workspaceLocked },
      select: {
        id: true,
        registrationType: true,
        registrationNumber: true,
        registrationSource: true,
        billingScope: true,
        visibility: true,
      },
    });
    expect(before?.registrationType).toBe("INTERNAL_NORMAL");

    const workspace = await applyLockedRegistrationAdjustment(
      testIds.workspaceLocked,
      { id: testIds.examOfficer, role: "EXAM_OFFICER" },
      {
        reason: "Integration post-lock adjustment",
        addExamSessionIds: [testIds.sessionClosed2],
      },
    );

    expect(workspace.id).toBe(testIds.workspaceLocked);
    expect(workspace.registrationType).toBe("INTERNAL_NORMAL");
    expect(workspace.registrationSource).toBe("STUDENT_SUBMITTED");
    expect(workspace.billingScope).toBe("NORMAL_BILLING");
    expect(workspace.visibility).toBe("STUDENT_AND_TEACHER");
    expect(workspace.visibleToStudent).toBe(true);
    expect(workspace.visibleToTeacher).toBe(true);
    if (before?.registrationNumber) {
      expect(workspace.registrationNumber).toBe(before.registrationNumber);
    }

    const added = await prisma.studentExamRegistration.findFirst({
      where: {
        registrationWorkspaceId: testIds.workspaceLocked,
        examSessionId: testIds.sessionClosed2,
        status: { in: ["ACTIVE", "LOCKED"] },
      },
    });
    expect(added).not.toBeNull();
    expect(added?.registrationSource).toBe("EO_POST_LOCK_ADJUSTMENT");
    expect(added?.registrationType).toBe("INTERNAL_NORMAL");
    expect(added?.billingScope).toBe("NORMAL_BILLING");
    expect(added?.visibility).toBe("STUDENT_AND_TEACHER");
    expect(added?.visibleToStudent).toBe(true);
    expect(added?.visibleToTeacher).toBe(true);

    const summaryAudit = await prisma.registrationAuditLog.findFirst({
      where: {
        registrationWorkspaceId: testIds.workspaceLocked,
        action: "EO_POST_LOCK_ADJUSTMENT",
        reason: "Integration post-lock adjustment",
      },
      orderBy: { performedAt: "desc" },
    });
    expect(summaryAudit).not.toBeNull();
  });

  it("prevents duplicate exam registration", async () => {
    await expect(
      createStudentRegistration(testIds.studentInternal, testIds.sessionOpen),
    ).rejects.toBeInstanceOf(RegistrationError);
  });

  it("creates registration audit log entries", async () => {
    const beforeCount = await prisma.registrationAuditLog.count();
    await createRegistrationAuditLog({
      registrationWorkspaceId: testIds.workspaceLocked,
      studentId: testIds.studentInternal,
      examSessionId: testIds.sessionClosed1,
      action: "STUDENT_REGISTRATION_SUBMITTED",
      performedById: testIds.studentInternal,
      performedByRole: "STUDENT",
      note: "Integration audit log test",
    });
    const afterCount = await prisma.registrationAuditLog.count();
    expect(afterCount).toBeGreaterThan(beforeCount);
  });
});

afterAll(async () => {
  await disconnectPrismaClient(prisma);
});
