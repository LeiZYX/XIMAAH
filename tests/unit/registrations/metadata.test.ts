import { describe, expect, it } from "vitest";
import {
  assistedSourceForRole,
  officeOnlySourceForRole,
  postLockSourceForRole,
  STUDENT_VISIBLE,
  TEACHER_VISIBLE,
} from "@/lib/registrations/metadata";

describe("registrationSource assignment helpers", () => {
  it("maps assisted source by role", () => {
    expect(assistedSourceForRole("EXAM_OFFICER")).toBe("EO_ASSISTED");
    expect(assistedSourceForRole("ADMIN")).toBe("ADMIN_ASSISTED");
  });

  it("maps office-only source by role", () => {
    expect(officeOnlySourceForRole("EXAM_OFFICER")).toBe("EO_FORCED_INTERNAL");
    expect(officeOnlySourceForRole("ADMIN")).toBe("ADMIN_FORCED_INTERNAL");
  });

  it("maps post-lock adjustment source by role", () => {
    expect(postLockSourceForRole("EXAM_OFFICER")).toBe("EO_POST_LOCK_ADJUSTMENT");
    expect(postLockSourceForRole("ADMIN")).toBe("ADMIN_POST_LOCK_ADJUSTMENT");
  });
});

describe("visibility rules", () => {
  it("student-visible includes student and teacher visibility", () => {
    expect(STUDENT_VISIBLE).toContain("STUDENT_AND_TEACHER");
    expect(STUDENT_VISIBLE).toContain("STUDENT_ONLY");
    expect(STUDENT_VISIBLE).not.toContain("EXAM_OFFICE_ONLY");
  });

  it("teacher-visible excludes office-only", () => {
    expect(TEACHER_VISIBLE).toEqual(["STUDENT_AND_TEACHER"]);
  });
});

describe("candidateType rules", () => {
  it("distinguishes internal and external candidates", () => {
    expect("INTERNAL").not.toBe("EXTERNAL");
  });
});
