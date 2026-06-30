import { describe, expect, it } from "vitest";
import {
  formatConfirmationNumber,
  formatFeeStatementNumber,
  feeStatementNumberPattern,
  confirmationNumberPattern,
  formatRegistrationNumber,
  registrationNumberPattern,
  registrationNumberPrefix,
} from "@/lib/registrations/numbering";

describe("registration number formatting", () => {
  it("maps registration types to prefixes", () => {
    expect(registrationNumberPrefix("INTERNAL_NORMAL")).toBe("IN");
    expect(registrationNumberPrefix("RESTRICTED_INTERNAL")).toBe("RI");
    expect(registrationNumberPrefix("EXTERNAL")).toBe("EX");
  });

  it("builds pattern per type and year", () => {
    expect(registrationNumberPattern("INTERNAL_NORMAL", 2026)).toBe("REG-IN-2026-");
    expect(registrationNumberPattern("RESTRICTED_INTERNAL", 2026)).toBe("REG-RI-2026-");
    expect(registrationNumberPattern("EXTERNAL", 2026)).toBe("REG-EX-2026-");
  });

  it("formats sequence with six-digit padding", () => {
    expect(formatRegistrationNumber("INTERNAL_NORMAL", 2026, 1)).toBe("REG-IN-2026-000001");
    expect(formatRegistrationNumber("RESTRICTED_INTERNAL", 2026, 42)).toBe("REG-RI-2026-000042");
    expect(formatRegistrationNumber("EXTERNAL", 2026, 123456)).toBe("REG-EX-2026-123456");
  });
});

describe("fee statement number formatting", () => {
  it("builds FS pattern per type and year", () => {
    expect(feeStatementNumberPattern("INTERNAL_NORMAL", 2026)).toBe("FS-IN-2026-");
    expect(feeStatementNumberPattern("RESTRICTED_INTERNAL", 2026)).toBe("FS-RI-2026-");
    expect(feeStatementNumberPattern("EXTERNAL", 2026)).toBe("FS-EX-2026-");
  });

  it("formats FS sequence with six-digit padding", () => {
    expect(formatFeeStatementNumber("INTERNAL_NORMAL", 2026, 1)).toBe("FS-IN-2026-000001");
    expect(formatFeeStatementNumber("RESTRICTED_INTERNAL", 2026, 42)).toBe("FS-RI-2026-000042");
    expect(formatFeeStatementNumber("EXTERNAL", 2026, 99)).toBe("FS-EX-2026-000099");
  });
});

describe("confirmation number formatting", () => {
  it("builds IC pattern per type and year", () => {
    expect(confirmationNumberPattern("INTERNAL_NORMAL", 2026)).toBe("IC-IN-2026-");
    expect(confirmationNumberPattern("RESTRICTED_INTERNAL", 2026)).toBe("IC-RI-2026-");
    expect(confirmationNumberPattern("EXTERNAL", 2026)).toBe("IC-EX-2026-");
  });

  it("formats IC sequence with six-digit padding", () => {
    expect(formatConfirmationNumber("INTERNAL_NORMAL", 2026, 1)).toBe("IC-IN-2026-000001");
    expect(formatConfirmationNumber("RESTRICTED_INTERNAL", 2026, 42)).toBe("IC-RI-2026-000042");
    expect(formatConfirmationNumber("EXTERNAL", 2026, 99)).toBe("IC-EX-2026-000099");
  });
});
