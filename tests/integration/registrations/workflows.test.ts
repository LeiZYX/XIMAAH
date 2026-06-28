import { describe, expect, it, afterAll } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createRegistrationAuditLog } from "@/lib/registrations/audit";
import { RegistrationError } from "@/lib/registrations/errors";
import { createStudentRegistration } from "@/lib/registrations/service";
import {
  applyAssistedRegistration,
  applyExternalCandidateRegistration,
  applyOfficeOnlyInternalRegistration,
} from "@/lib/registrations/workflows";
import { testIds } from "../../fixtures/manifest";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

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
  await prisma.$disconnect();
  await pool.end();
});
