import { describe, expect, it } from "vitest";
import {
  canCancelCashInRequest,
  canTransitionCashInRequestStatus,
  cashInRequestStatusLabel,
} from "@/lib/cash-in-requests/status";

describe("cash-in request status rules", () => {
  it("allows cancel only before sent to board", () => {
    expect(canCancelCashInRequest("DRAFT")).toBe(true);
    expect(canCancelCashInRequest("SUBMITTED")).toBe(true);
    expect(canCancelCashInRequest("SENT_TO_BOARD")).toBe(false);
    expect(canCancelCashInRequest("COMPLETED")).toBe(false);
    expect(canCancelCashInRequest("CANCELLED")).toBe(false);
  });

  it("enforces the intended workflow transitions", () => {
    expect(canTransitionCashInRequestStatus("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransitionCashInRequestStatus("DRAFT", "CANCELLED")).toBe(true);
    expect(canTransitionCashInRequestStatus("DRAFT", "SENT_TO_BOARD")).toBe(false);
    expect(canTransitionCashInRequestStatus("SUBMITTED", "SENT_TO_BOARD")).toBe(true);
    expect(canTransitionCashInRequestStatus("SUBMITTED", "CANCELLED")).toBe(true);
    expect(canTransitionCashInRequestStatus("SENT_TO_BOARD", "COMPLETED")).toBe(true);
    expect(canTransitionCashInRequestStatus("SENT_TO_BOARD", "CANCELLED")).toBe(false);
    expect(canTransitionCashInRequestStatus("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("reflects payment state on submitted requests", () => {
    expect(cashInRequestStatusLabel("SUBMITTED")).toBe("Submitted");
    expect(cashInRequestStatusLabel("SUBMITTED", null)).toBe("Submitted (no invoice)");
    expect(
      cashInRequestStatusLabel("SUBMITTED", {
        status: "ISSUED",
        totalGbpAmount: 10,
        amountDueGbpAmount: 10,
      }),
    ).toBe("Submitted (awaiting payment)");
    expect(
      cashInRequestStatusLabel("SUBMITTED", {
        status: "PAID",
        totalGbpAmount: 10,
        amountDueGbpAmount: 0,
      }),
    ).toBe("Submitted (paid — ready for board)");
  });
});
