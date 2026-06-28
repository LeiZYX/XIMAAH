import { expect, test } from "@playwright/test";
import { testIds } from "./fixtures/test-data";
import { authHeaders, loginViaApi, loginAs } from "./helpers/auth";

test.describe.configure({ mode: "serial" });

test.describe("Teacher change requests", () => {
  test("teacher can submit change request", async ({ request }) => {
    const cookie = await loginViaApi(request, "teacher");

    const response = await request.post("/api/teacher/change-requests", {
      headers: authHeaders(cookie),
      data: {
        registrationWorkspaceId: testIds.workspaceLocked,
        requestType: "REMOVE_EXAM",
        targetRegistrationId: testIds.registrationLocked,
        reason: "E2E teacher remove exam request",
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe("PENDING");
  });

  test("EO can reject teacher request", async ({ request }) => {
    const teacherCookie = await loginViaApi(request, "teacher");
    const eoCookie = await loginViaApi(request, "examOfficer");

    const submit = await request.post("/api/teacher/change-requests", {
      headers: authHeaders(teacherCookie),
      data: {
        registrationWorkspaceId: testIds.workspaceLocked,
        requestType: "ADD_EXAM",
        targetExamSessionId: testIds.sessionClosed2,
        reason: "E2E rejection flow",
      },
    });
    expect(submit.status()).toBe(201);
    const changeRequest = await submit.json();

    const reject = await request.post(
      `/api/exam-office/change-requests/${changeRequest.id}/reject`,
      {
        headers: authHeaders(eoCookie),
        data: { reviewNote: "Not required for this candidate" },
      },
    );
    expect(reject.ok()).toBeTruthy();

    const list = await request.get("/api/exam-office/change-requests?status=REJECTED", {
      headers: authHeaders(eoCookie),
    });
    const rows = await list.json();
    expect(rows.some((row: { id: string }) => row.id === changeRequest.id)).toBe(true);
  });

  test("EO can approve teacher request and locked registration updates", async ({ request }) => {
    const teacherCookie = await loginViaApi(request, "teacher");
    const eoCookie = await loginViaApi(request, "examOfficer");

    const before = await request.get(`/api/exam-office/registrations/${testIds.workspaceLocked}`, {
      headers: authHeaders(eoCookie),
    });
    const beforeDetail = await before.json();
    const countBefore = beforeDetail.registrations.length;

    const submit = await request.post("/api/teacher/change-requests", {
      headers: authHeaders(teacherCookie),
      data: {
        registrationWorkspaceId: testIds.workspaceLocked,
        requestType: "ADD_EXAM",
        targetExamSessionId: testIds.sessionClosed2,
        reason: "E2E approval flow",
      },
    });
    expect(submit.status()).toBe(201);
    const changeRequest = await submit.json();

    const approve = await request.post(
      `/api/exam-office/change-requests/${changeRequest.id}/approve`,
      { headers: authHeaders(eoCookie) },
    );
    expect(approve.ok()).toBeTruthy();

    const workspace = await request.get(`/api/exam-office/registrations/${testIds.workspaceLocked}`, {
      headers: authHeaders(eoCookie),
    });
    const detail = await workspace.json();
    expect(detail.registrations.length).toBeGreaterThan(countBefore);
  });

  test("locked registration detail shows print button", async ({ page }) => {
    await loginAs(page, "examOfficer");
    await page.goto(`/exam-office/registrations/${testIds.workspaceLocked}`);
    await expect(page.getByRole("button", { name: "Print Confirmation" })).toBeVisible();
  });
});
