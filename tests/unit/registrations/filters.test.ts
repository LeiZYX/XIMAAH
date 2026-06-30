import { describe, expect, it } from "vitest";
import {
  buildStudentVisibleRegistrationWhere,
  buildTeacherVisibleRegistrationWhere,
} from "@/lib/registrations/filters";

describe("registration list visibility filters", () => {
  it("student filter only includes internal normal portal-visible rows", () => {
    const where = buildStudentVisibleRegistrationWhere("student-1");
    expect(where).toMatchObject({
      status: { in: ["ACTIVE", "LOCKED"] },
      registrationType: "INTERNAL_NORMAL",
      visibleToStudent: true,
      visibleInStudentPortal: true,
      visibility: { in: ["STUDENT_AND_TEACHER", "STUDENT_ONLY"] },
    });
  });

  it("teacher filter only includes internal normal teacher-visible rows", () => {
    const where = buildTeacherVisibleRegistrationWhere({});
    expect(where).toMatchObject({
      AND: expect.arrayContaining([
        { registrationType: "INTERNAL_NORMAL" },
        { visibleToTeacher: true },
        { visibleInTeacherPortal: true },
        { visibility: { in: ["STUDENT_AND_TEACHER"] } },
      ]),
    });
  });
});
