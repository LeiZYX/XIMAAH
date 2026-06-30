import { expect, test } from "@playwright/test";
import { testIds } from "./fixtures/test-data";
import { authHeaders, loginViaApi, loginAs } from "./helpers/auth";

test.describe("Student registration flows", () => {
  test("student can register during open window", async ({ request }) => {
    const cookie = await loginViaApi(request, "assistedStudent");

    const response = await request.post("/api/registrations", {
      headers: authHeaders(cookie),
      data: { examSessionId: testIds.sessionOpen },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.examSessionId).toBe(testIds.sessionOpen);
    expect(body.registrationSource).toBe("STUDENT_SUBMITTED");
    expect(body.visibility).toBe("STUDENT_AND_TEACHER");
  });

  test("student cannot remove locked registration", async ({ page, request }) => {
    const cookie = await loginViaApi(request, "internalStudent");
    const deleteResponse = await request.delete(`/api/registrations/${testIds.registrationLocked}`, {
      headers: authHeaders(cookie),
    });
    expect(deleteResponse.status()).toBeGreaterThanOrEqual(400);

    await loginAs(page, "internalStudent");
    await page.goto("/student/registrations");

    await expect(page.getByRole("heading", { name: "Test Closed Registration Window" })).toBeVisible();
    await expect(page.getByText("Locked", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  });

  test("duplicate registration is rejected", async ({ request }) => {
    const cookie = await loginViaApi(request, "assistedStudent");

    const first = await request.post("/api/registrations", {
      headers: authHeaders(cookie),
      data: { examSessionId: testIds.sessionOpen },
    });
    expect([201, 409]).toContain(first.status());

    const second = await request.post("/api/registrations", {
      headers: authHeaders(cookie),
      data: { examSessionId: testIds.sessionOpen },
    });
    expect(second.status()).toBe(409);
  });
});

test.describe("Exam officer registration workflows", () => {
  test("EO can register on behalf of internal student", async ({ request }) => {
    const cookie = await loginViaApi(request, "examOfficer");

    const response = await request.post("/api/exam-office/assisted-registrations", {
      headers: authHeaders(cookie),
      data: {
        studentId: testIds.studentInternal,
        registrationWindowId: testIds.windowOpen,
        examSessionIds: [testIds.sessionOpen],
        reason: "E2E assisted registration test",
      },
    });

    expect(response.status()).toBe(201);
    const workspace = await response.json();
    expect(workspace.registrationSource).toBe("EO_ASSISTED");
    expect(workspace.visibility).toBe("STUDENT_AND_TEACHER");
    expect(workspace.billingScope).toBe("NORMAL_BILLING");
    expect(workspace.registrationType).toBe("INTERNAL_NORMAL");
    expect(workspace.registrationNumber).toMatch(/^REG-IN-\d{4}-\d{6}$/);
  });

  test("EO can create office-only registration", async ({ request }) => {
    const cookie = await loginViaApi(request, "examOfficer");

    const response = await request.post("/api/exam-office/office-only-registrations", {
      headers: authHeaders(cookie),
      data: {
        studentId: testIds.studentAssisted,
        registrationWindowId: testIds.windowOpen,
        examSessionIds: [testIds.sessionOfficeOnly],
        reason: "E2E office-only registration test",
      },
    });

    expect(response.status()).toBe(201);
    const workspace = await response.json();
    expect(workspace.registrationSource).toBe("EO_FORCED_INTERNAL");
    expect(workspace.visibility).toBe("EXAM_OFFICE_ONLY");
    expect(workspace.billingScope).toBe("RESTRICTED_BILLING");
    expect(workspace.registrationType).toBe("RESTRICTED_INTERNAL");
    expect(workspace.registrationNumber).toMatch(/^REG-RI-\d{4}-\d{6}$/);
  });

  test("office-only registration is hidden from student and teacher", async ({ request }) => {
    const studentCookie = await loginViaApi(request, "internalStudent");
    const teacherCookie = await loginViaApi(request, "teacher");

    const studentRows = await request.get("/api/registrations/me", {
      headers: authHeaders(studentCookie),
    });
    expect(studentRows.ok()).toBeTruthy();
    const studentData = await studentRows.json();
    expect(
      studentData.every(
        (row: { visibility: string }) => row.visibility !== "EXAM_OFFICE_ONLY",
      ),
    ).toBe(true);

    const teacherRows = await request.get("/api/teacher/registrations", {
      headers: authHeaders(teacherCookie),
    });
    expect(teacherRows.ok()).toBeTruthy();
    const teacherData = await teacherRows.json();
    expect(
      teacherData.every(
        (row: { visibility: string }) => row.visibility !== "EXAM_OFFICE_ONLY",
      ),
    ).toBe(true);
  });

  test("external candidate registration is visible only to EO/Admin", async ({ request }) => {
    const eoCookie = await loginViaApi(request, "examOfficer");
    const teacherCookie = await loginViaApi(request, "teacher");

    const create = await request.post("/api/exam-office/external-candidate-registrations", {
      headers: authHeaders(eoCookie),
      data: {
        candidateId: testIds.candidateExternal,
        registrationWindowId: testIds.windowOpen,
        examSessionIds: [testIds.sessionOfficeOnly],
        reason: "E2E external candidate registration",
      },
    });
    expect(create.status()).toBe(201);
    const workspace = await create.json();
    expect(workspace.registrationSource).toBe("EXTERNAL_CANDIDATE");
    expect(workspace.visibility).toBe("EXAM_OFFICE_ONLY");
    expect(workspace.billingScope).toBe("EXTERNAL_BILLING");
    expect(workspace.registrationType).toBe("EXTERNAL");
    expect(workspace.registrationNumber).toMatch(/^REG-EX-\d{4}-\d{6}$/);

    const eoList = await request.get(
      "/api/exam-office/registrations?registrationSource=EXTERNAL_CANDIDATE",
      { headers: authHeaders(eoCookie) },
    );
    expect(eoList.ok()).toBeTruthy();
    const eoRows = await eoList.json();
    const rows = Array.isArray(eoRows)
      ? eoRows
      : (eoRows.registrations ?? eoRows.items ?? []);
    expect(rows.length).toBeGreaterThan(0);

    const teacherRows = await request.get("/api/teacher/registrations", {
      headers: authHeaders(teacherCookie),
    });
    const teacherData = await teacherRows.json();
    expect(
      teacherData.every(
        (row: { registrationSource: string }) => row.registrationSource !== "EXTERNAL_CANDIDATE",
      ),
    ).toBe(true);
  });
});
