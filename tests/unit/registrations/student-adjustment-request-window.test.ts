import { describe, expect, it } from "vitest";
import {
  canStudentSubmitAdjustmentRequest,
  resolveStudentAdjustmentRequestCloseAt,
} from "@/lib/registrations/window";

describe("student late adjustment request window rules", () => {
  const base = {
    status: "OPEN" as const,
    studentRegistrationOpenAt: new Date("2026-09-01T00:00:00.000Z"),
    studentRegistrationCloseAt: new Date("2026-10-01T00:00:00.000Z"),
    registrationCloseAt: new Date("2026-11-01T00:00:00.000Z"),
  };

  it("is disabled when the window flag is off", () => {
    expect(
      canStudentSubmitAdjustmentRequest(
        { ...base, studentAdjustmentRequestEnabled: false },
        new Date("2026-10-15T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("allows submit after student close and before request close", () => {
    expect(
      canStudentSubmitAdjustmentRequest(
        {
          ...base,
          studentAdjustmentRequestEnabled: true,
          studentAdjustmentRequestCloseAt: new Date("2026-10-20T00:00:00.000Z"),
        },
        new Date("2026-10-15T00:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("soft-stops at final registration close when request close is unset", () => {
    expect(
      resolveStudentAdjustmentRequestCloseAt({
        ...base,
        studentAdjustmentRequestEnabled: true,
        studentAdjustmentRequestCloseAt: null,
      }),
    ).toEqual(base.registrationCloseAt);

    expect(
      canStudentSubmitAdjustmentRequest(
        {
          ...base,
          studentAdjustmentRequestEnabled: true,
          studentAdjustmentRequestCloseAt: null,
        },
        new Date("2026-10-25T00:00:00.000Z"),
      ),
    ).toBe(true);

    expect(
      canStudentSubmitAdjustmentRequest(
        {
          ...base,
          studentAdjustmentRequestEnabled: true,
          studentAdjustmentRequestCloseAt: null,
        },
        new Date("2026-11-02T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("rejects before student close and after request close", () => {
    const window = {
      ...base,
      studentAdjustmentRequestEnabled: true,
      studentAdjustmentRequestCloseAt: new Date("2026-10-20T00:00:00.000Z"),
    };
    expect(canStudentSubmitAdjustmentRequest(window, new Date("2026-09-15T00:00:00.000Z"))).toBe(
      false,
    );
    expect(canStudentSubmitAdjustmentRequest(window, new Date("2026-10-21T00:00:00.000Z"))).toBe(
      false,
    );
  });
});
