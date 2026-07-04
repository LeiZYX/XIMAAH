import { describe, expect, it } from "vitest";
import {
  buildTeacherAssignmentWhere,
  canStudentViewRegistration,
  canTeacherViewRegistration,
  isHiddenFromStudentPortal,
  isHiddenFromTeacherPortal,
  matchesTeacherAssignment,
  type TeacherRegistrationScope,
} from "@/lib/registrations/visibility";

const visibleInternalNormal = {
  registrationType: "INTERNAL_NORMAL",
  visibility: "STUDENT_AND_TEACHER",
  visibleToStudent: true,
  visibleToTeacher: true,
  visibleInStudentPortal: true,
  visibleInTeacherPortal: true,
  status: "LOCKED",
  subjectId: "subject-1",
  gradeSnapshot: "Y12",
  classNameSnapshot: "12A",
};

const postLockAdjusted = {
  ...visibleInternalNormal,
  registrationSource: "EO_POST_LOCK_ADJUSTMENT",
};

const restrictedInternal = {
  registrationType: "RESTRICTED_INTERNAL",
  visibility: "EXAM_OFFICE_ONLY",
  visibleToStudent: false,
  visibleToTeacher: false,
  visibleInStudentPortal: false,
  visibleInTeacherPortal: false,
  status: "LOCKED",
};

const externalCandidate = {
  registrationType: "EXTERNAL",
  visibility: "EXAM_OFFICE_ONLY",
  visibleToStudent: false,
  visibleToTeacher: false,
  visibleInStudentPortal: false,
  visibleInTeacherPortal: false,
  status: "LOCKED",
};

const teacherScope: TeacherRegistrationScope = {
  subjectIds: ["subject-1"],
  visibleGrades: [],
  visibleClasses: [],
};

describe("portal visibility helpers", () => {
  it("allows student-visible internal normal registrations", () => {
    expect(canStudentViewRegistration(visibleInternalNormal)).toBe(true);
    expect(canStudentViewRegistration(postLockAdjusted)).toBe(true);
  });

  it("hides restricted, external, and office-only registrations from students", () => {
    expect(isHiddenFromStudentPortal(restrictedInternal)).toBe(true);
    expect(isHiddenFromStudentPortal(externalCandidate)).toBe(true);
    expect(canStudentViewRegistration(restrictedInternal)).toBe(false);
    expect(canStudentViewRegistration(externalCandidate)).toBe(false);
  });

  it("hides restricted, external, and office-only registrations from teachers", () => {
    expect(isHiddenFromTeacherPortal(restrictedInternal)).toBe(true);
    expect(isHiddenFromTeacherPortal(externalCandidate)).toBe(true);
    expect(canTeacherViewRegistration(visibleInternalNormal)).toBe(true);
    expect(canTeacherViewRegistration(postLockAdjusted)).toBe(true);
    expect(canTeacherViewRegistration(restrictedInternal)).toBe(false);
  });

  it("does not scope teacher visibility to assigned subjects", () => {
    expect(
      matchesTeacherAssignment(
        {
          subjectId: "subject-1",
          gradeSnapshot: "Y12",
          classNameSnapshot: "12A",
        },
        teacherScope,
      ),
    ).toBe(true);

    expect(
      canTeacherViewRegistration({ ...visibleInternalNormal, subjectId: "subject-2" }),
    ).toBe(true);
  });

  it("returns no rows when teacher has no subject assignments", () => {
    expect(buildTeacherAssignmentWhere({ subjectIds: [], visibleGrades: [], visibleClasses: [] })).toEqual({
      id: { in: [] },
    });
  });
});
