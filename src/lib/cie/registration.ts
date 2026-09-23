import { RegistrationAuditAction, RegistrationStatus } from "@/generated/prisma/enums";
import type { UserRole } from "@/generated/prisma/enums";
import {
  assertCieWindow,
  listCieOptionsForSeries,
  listCieOptionsForSyllabus,
  resolveSubjectForSyllabus,
  toOptionDefs,
  type CieSyllabusOptionRecord,
} from "@/lib/cie/catalog";
import {
  matchOptionForComponents,
  normalizeComponentCode,
  parseJsonStringArray,
} from "@/lib/cie/option-match";
import { syncCandidateFromStudentUser } from "@/lib/candidates/service";
import { prisma } from "@/lib/prisma";
import {
  createRegistrationAuditLog,
  registrationAuditSnapshot,
} from "@/lib/registrations/audit";
import { RegistrationError } from "@/lib/registrations/errors";
import { registrationInclude } from "@/lib/registrations/include";
import { flagsForRegistrationType } from "@/lib/registrations/metadata";
import {
  resolveEntryTypeForRegistration,
  type RegistrationFeeStageRecord,
} from "@/lib/registrations/fee-stages";
import { ensureExpiredWindowsLocked } from "@/lib/registrations/lock";
import { canStudentEditRegistrationList, canStudentRegisterInWindow } from "@/lib/registrations/window";
import { ensureRegistrationWorkspaceForCandidate } from "@/lib/registrations/workspace";
import { assertStudentCanRegister } from "@/lib/students/archive";
import { candidateRegistrationSnapshots } from "@/lib/candidates/service";
import { windowIncludesSeries } from "@/lib/registrations/included-series";

type SessionForCie = {
  id: string;
  examSeriesId: string;
  paper: {
    id: string;
    code: string;
    subjectId: string;
    subject: {
      id: string;
      code: string;
      name: string;
      qualification: { examBoardId: string };
    };
  };
};

function paperComponentCode(paperCode: string): string {
  return normalizeComponentCode(paperCode);
}

async function loadWindowSessionsForSubject(params: {
  registrationWindowId: string;
  examBoardId: string;
  subjectId: string;
  includedSeriesIds: string[];
  primarySeriesId: string;
}) {
  const seriesIds = [...new Set([params.primarySeriesId, ...params.includedSeriesIds])];
  const sessions = await prisma.examSession.findMany({
    where: {
      examSeriesId: { in: seriesIds },
      paper: { subjectId: params.subjectId },
    },
    include: {
      paper: {
        include: {
          subject: { include: { qualification: true } },
        },
      },
    },
  });

  return sessions.filter((session) =>
    windowIncludesSeries(
      {
        examBoardId: params.examBoardId,
        examSeriesId: params.primarySeriesId,
        includedSeries: params.includedSeriesIds.map((examSeriesId) => ({
          examSeriesId,
          examSeries: { examBoardId: params.examBoardId },
        })),
      },
      session.examSeriesId,
      params.examBoardId,
    ),
  ) as SessionForCie[];
}

function findSessionsForOption(
  sessions: SessionForCie[],
  option: CieSyllabusOptionRecord,
): SessionForCie[] {
  const needed = new Set(option.componentCodes.map(normalizeComponentCode));
  const matched: SessionForCie[] = [];
  const found = new Set<string>();

  for (const session of sessions) {
    const code = paperComponentCode(session.paper.code);
    if (needed.has(code) && !found.has(code)) {
      matched.push(session);
      found.add(code);
    }
  }

  if (found.size !== needed.size) {
    const missing = [...needed].filter((c) => !found.has(c));
    throw new RegistrationError(
      `No exam sessions in this window for components: ${missing.join(", ")}`,
      400,
    );
  }

  return matched;
}

async function assertNoDisallowedConflict(params: {
  candidateId: string;
  registrationWindowId: string;
  option: CieSyllabusOptionRecord;
}) {
  if (params.option.disallowedSyllabusCodes.length === 0) return;

  const existing = await prisma.cieEntryAssignment.findMany({
    where: {
      candidateId: params.candidateId,
      registrationWindowId: params.registrationWindowId,
      status: { in: [RegistrationStatus.ACTIVE, RegistrationStatus.PENDING_SUBJECT_TEACHER, RegistrationStatus.LOCKED] },
    },
    select: { syllabusCode: true },
  });

  const taken = new Set(existing.map((row) => row.syllabusCode.toUpperCase()));
  for (const code of params.option.disallowedSyllabusCodes) {
    if (taken.has(code)) {
      throw new RegistrationError(
        `Cannot register ${params.option.syllabusCode} while ${code} is already registered. Withdraw ${code} first.`,
        400,
      );
    }
  }

  // Reverse: if another syllabus disallows this one
  const others = await prisma.cieSyllabusOption.findMany({
    where: {
      examSeriesId: params.option.examSeriesId,
      syllabusCode: { in: [...taken] },
      active: true,
    },
  });
  for (const other of others) {
    const blocked = parseJsonStringArray(other.disallowedSyllabusCodes).map((c) =>
      c.trim().toUpperCase(),
    );
    if (blocked.includes(params.option.syllabusCode)) {
      throw new RegistrationError(
        `Cannot register ${params.option.syllabusCode} while ${other.syllabusCode} is already registered.`,
        400,
      );
    }
  }
}

export async function previewCieOptionMatch(params: {
  registrationWindowId: string;
  subjectId: string;
  examSessionIds: string[];
}) {
  const window = await assertCieWindow(params.registrationWindowId);
  const subject = await prisma.subject.findUnique({
    where: { id: params.subjectId },
    select: { id: true, code: true, name: true },
  });
  if (!subject) throw new RegistrationError("Subject not found", 404);

  const options = await listCieOptionsForSyllabus({
    examSeriesId: window.examSeriesId,
    syllabusCode: subject.code,
  });
  if (options.length === 0) {
    throw new RegistrationError(
      `No CIE options configured for syllabus ${subject.code} in this series`,
      400,
    );
  }

  const sessions = await prisma.examSession.findMany({
    where: { id: { in: params.examSessionIds } },
    include: { paper: { select: { code: true, subjectId: true } } },
  });
  if (sessions.some((s) => s.paper.subjectId !== params.subjectId)) {
    throw new RegistrationError("All sessions must belong to the same subject", 400);
  }

  const components = sessions.map((s) => paperComponentCode(s.paper.code));
  const match = matchOptionForComponents(toOptionDefs(options), components);
  return { subject, options, match, components };
}

export async function registerCieOptionForStudent(params: {
  studentId: string;
  registrationWindowId: string;
  subjectId?: string;
  syllabusCode?: string;
  optionCode: string;
  /** When true and window requires confirmation, skip pending (teacher/EO self-confirm). */
  autoConfirm?: boolean;
  performedByRole?: UserRole;
}) {
  await ensureExpiredWindowsLocked();
  await assertStudentCanRegister(params.studentId);
  const now = new Date();

  const window = await assertCieWindow(params.registrationWindowId);
  if (
    !canStudentRegisterInWindow(
      {
        ...window,
        studentSelfRegistrationEnabled: window.studentSelfRegistrationEnabled ?? true,
      },
      [],
      now,
    )
  ) {
    throw new RegistrationError("Student registration is not open for this window", 400);
  }

  const student = await prisma.user.findUnique({
    where: { id: params.studentId },
    include: { studentProfile: true },
  });
  if (!student?.studentProfile || student.role !== "STUDENT") {
    throw new RegistrationError("Student account required", 403);
  }

  const candidate = await syncCandidateFromStudentUser(params.studentId);
  if (!candidate) {
    throw new RegistrationError("Could not resolve candidate profile", 400);
  }

  const syllabusCode = (
    params.syllabusCode ??
    (
      await prisma.subject.findUnique({
        where: { id: params.subjectId ?? "" },
        select: { code: true },
      })
    )?.code
  )
    ?.trim()
    .toUpperCase();
  if (!syllabusCode) {
    throw new RegistrationError("Subject or syllabus code is required", 400);
  }

  const options = await listCieOptionsForSyllabus({
    examSeriesId: window.examSeriesId,
    syllabusCode,
  });
  const option = options.find(
    (row) => row.optionCode === params.optionCode.trim().toUpperCase(),
  );
  if (!option) {
    throw new RegistrationError(
      `Option ${params.optionCode} is not available for syllabus ${syllabusCode}`,
      400,
    );
  }

  const subject =
    (await resolveSubjectForSyllabus({
      examBoardId: window.examBoardId,
      syllabusCode,
      preferredSubjectId: params.subjectId ?? option.subjectId,
    })) ??
    (params.subjectId
      ? await prisma.subject.findUnique({
          where: { id: params.subjectId },
          include: { papers: { select: { id: true, code: true } } },
        })
      : null);

  if (!subject) {
    throw new RegistrationError(
      `No Hub subject found for syllabus ${syllabusCode}. Map the option to a subject or create the subject.`,
      400,
    );
  }

  await assertNoDisallowedConflict({
    candidateId: candidate.id,
    registrationWindowId: window.id,
    option,
  });

  const sessions = findSessionsForOption(
    await loadWindowSessionsForSubject({
      registrationWindowId: window.id,
      examBoardId: window.examBoardId,
      subjectId: subject.id,
      includedSeriesIds: window.includedSeries.map((row) => row.examSeriesId),
      primarySeriesId: window.examSeriesId,
    }),
    option,
  );

  const feeStages = await prisma.registrationFeeStage.findMany({
    where: { registrationWindowId: window.id },
  });
  const entry = resolveEntryTypeForRegistration({
    feeStages: feeStages as RegistrationFeeStageRecord[],
    now,
  });

  const requireConfirm =
    window.requireSubjectTeacherConfirmation && !params.autoConfirm;
  const status = requireConfirm
    ? RegistrationStatus.PENDING_SUBJECT_TEACHER
    : RegistrationStatus.ACTIVE;

  const snapshots = candidateRegistrationSnapshots({
    englishName: student.name,
    studentNumber: student.studentProfile.studentNo,
    grade: student.studentProfile.currentGrade,
    className: student.studentProfile.currentClassName,
    email: student.studentProfile.email ?? student.email,
    phone: student.studentProfile.phone ?? student.phone,
    assessmentHubCandidateNumber: candidate.assessmentHubCandidateNumber,
    candidateType: candidate.candidateType,
  });

  return prisma.$transaction(async (tx) => {
    const workspace = await ensureRegistrationWorkspaceForCandidate(
      candidate.id,
      window.id,
      params.studentId,
      "INTERNAL_NORMAL",
      tx,
    );

    // Replace any existing assignment + papers for this syllabus
    const existingAssignment = await tx.cieEntryAssignment.findUnique({
      where: {
        candidateId_registrationWindowId_syllabusCode: {
          candidateId: candidate.id,
          registrationWindowId: window.id,
          syllabusCode,
        },
      },
    });

    if (existingAssignment) {
      await tx.studentExamRegistration.updateMany({
        where: {
          candidateId: candidate.id,
          registrationWindowId: window.id,
          subjectId: subject.id,
          status: {
            in: [
              RegistrationStatus.ACTIVE,
              RegistrationStatus.PENDING_SUBJECT_TEACHER,
            ],
          },
        },
        data: {
          status: RegistrationStatus.CANCELLED,
          cancelledAt: now,
        },
      });
      await tx.cieEntryAssignment.delete({ where: { id: existingAssignment.id } });
    }

    const createdRegs = [];
    for (const session of sessions) {
      const existing = await tx.studentExamRegistration.findUnique({
        where: {
          studentId_examSessionId: {
            studentId: params.studentId,
            examSessionId: session.id,
          },
        },
      });

      const data = {
        candidateId: candidate.id,
        studentId: params.studentId,
        examSessionId: session.id,
        registrationWindowId: window.id,
        registrationWorkspaceId: workspace.id,
        examBoardId: window.examBoardId,
        examSeriesId: session.examSeriesId,
        subjectId: subject.id,
        paperId: session.paper.id,
        ...snapshots,
        status,
        lockedAt: null,
        cancelledAt: null,
        registrationSource: "STUDENT_SUBMITTED" as const,
        visibility: "STUDENT_AND_TEACHER" as const,
        billingScope: "NORMAL_BILLING" as const,
        registrationType: "INTERNAL_NORMAL" as const,
        ...flagsForRegistrationType("INTERNAL_NORMAL"),
        entryType: entry.entryType,
        feeStageId: entry.feeStageId,
        entryTypeOverridden: entry.entryTypeOverridden,
      };

      const row = existing
        ? await tx.studentExamRegistration.update({
            where: { id: existing.id },
            data,
            include: registrationInclude,
          })
        : await tx.studentExamRegistration.create({
            data,
            include: registrationInclude,
          });

      await createRegistrationAuditLog(
        {
          registrationWorkspaceId: workspace.id,
          candidateId: candidate.id,
          studentId: params.studentId,
          registrationId: row.id,
          examSessionId: session.id,
          action: RegistrationAuditAction.STUDENT_ADD,
          performedById: params.studentId,
          performedByRole: "STUDENT",
          registrationSource: "STUDENT_SUBMITTED",
          registrationType: "INTERNAL_NORMAL",
          visibility: "STUDENT_AND_TEACHER",
          billingScope: "NORMAL_BILLING",
          assessmentHubCandidateNumberSnapshot: candidate.assessmentHubCandidateNumber,
          candidateTypeSnapshot: candidate.candidateType,
          afterValue: registrationAuditSnapshot(row),
          note: `CIE option ${syllabusCode}/${option.optionCode}`,
        },
        tx,
      );
      createdRegs.push(row);
    }

    const assignment = await tx.cieEntryAssignment.create({
      data: {
        registrationWindowId: window.id,
        registrationWorkspaceId: workspace.id,
        candidateId: candidate.id,
        studentId: params.studentId,
        subjectId: subject.id,
        syllabusCode,
        optionCode: option.optionCode,
        status,
        confirmedByUserId: requireConfirm ? null : params.studentId,
        confirmedAt: requireConfirm ? null : now,
      },
    });

    return { assignment, registrations: createdRegs, pendingConfirmation: requireConfirm };
  });
}

export async function registerCieComposeForStudent(params: {
  studentId: string;
  registrationWindowId: string;
  subjectId: string;
  examSessionIds: string[];
  autoConfirm?: boolean;
}) {
  const preview = await previewCieOptionMatch({
    registrationWindowId: params.registrationWindowId,
    subjectId: params.subjectId,
    examSessionIds: params.examSessionIds,
  });
  if (preview.match.status !== "exact") {
    const detail =
      preview.match.status === "partial"
        ? `Missing components: ${preview.match.missing.join(", ")}`
        : preview.match.status === "extra"
          ? `Extra components: ${preview.match.extra.join(", ")}`
          : "Combination does not match a valid option";
    throw new RegistrationError(
      `${detail}. Adjust papers or pick an option directly.`,
      400,
    );
  }

  return registerCieOptionForStudent({
    studentId: params.studentId,
    registrationWindowId: params.registrationWindowId,
    subjectId: params.subjectId,
    optionCode: preview.match.option.optionCode,
    autoConfirm: params.autoConfirm,
  });
}

export async function withdrawCieSyllabusForStudent(params: {
  studentId: string;
  registrationWindowId: string;
  syllabusCode: string;
}) {
  await ensureExpiredWindowsLocked();
  const window = await assertCieWindow(params.registrationWindowId);
  if (!canStudentEditRegistrationList(window, [])) {
    throw new RegistrationError(
      "Student registration has closed — contact your subject teacher or the Exams Office.",
      400,
    );
  }

  const candidate = await syncCandidateFromStudentUser(params.studentId);
  if (!candidate) throw new RegistrationError("Could not resolve candidate profile", 400);

  const syllabusCode = params.syllabusCode.trim().toUpperCase();
  const assignment = await prisma.cieEntryAssignment.findUnique({
    where: {
      candidateId_registrationWindowId_syllabusCode: {
        candidateId: candidate.id,
        registrationWindowId: window.id,
        syllabusCode,
      },
    },
  });
  if (!assignment) {
    throw new RegistrationError("CIE assignment not found", 404);
  }
  if (assignment.status === RegistrationStatus.LOCKED) {
    throw new RegistrationError("Locked CIE entries cannot be withdrawn here", 400);
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.studentExamRegistration.updateMany({
      where: {
        candidateId: candidate.id,
        registrationWindowId: window.id,
        subjectId: assignment.subjectId,
        status: {
          in: [RegistrationStatus.ACTIVE, RegistrationStatus.PENDING_SUBJECT_TEACHER],
        },
      },
      data: { status: RegistrationStatus.CANCELLED, cancelledAt: now },
    });
    await tx.cieEntryAssignment.delete({ where: { id: assignment.id } });
    return { ok: true as const, syllabusCode };
  });
}

export async function listCieOptionsForWindow(registrationWindowId: string) {
  const window = await assertCieWindow(registrationWindowId);
  return listCieOptionsForSeries(window.examSeriesId, true);
}

export async function cancelPendingCieOnStudentLock(windowId: string) {
  const now = new Date();
  const pending = await prisma.cieEntryAssignment.findMany({
    where: {
      registrationWindowId: windowId,
      status: RegistrationStatus.PENDING_SUBJECT_TEACHER,
    },
  });
  if (pending.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const assignment of pending) {
      await tx.studentExamRegistration.updateMany({
        where: {
          candidateId: assignment.candidateId,
          registrationWindowId: windowId,
          subjectId: assignment.subjectId,
          status: RegistrationStatus.PENDING_SUBJECT_TEACHER,
        },
        data: { status: RegistrationStatus.CANCELLED, cancelledAt: now },
      });
      await tx.cieEntryAssignment.delete({ where: { id: assignment.id } });
    }
  });

  return pending.length;
}
