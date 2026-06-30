import { expect, test } from "@playwright/test";
import { testIds } from "./fixtures/test-data";
import { authHeaders, loginViaApi, loginAs } from "./helpers/auth";

test.describe("Fee statements and reporting", () => {
  test("fee statement can be generated for locked registration", async ({ request }) => {
    const cookie = await loginViaApi(request, "examOfficer");

    const response = await request.post("/api/fee-statements", {
      headers: authHeaders(cookie),
      data: {
        workspaceId: testIds.workspaceLocked,
        displayCurrency: "GBP",
      },
    });

    expect(response.status()).toBe(201);
    const statement = await response.json();
    expect(statement.statementNo).toMatch(/^FS-IN-\d{4}-\d{6}$/);
    expect(statement.status).toBe("DRAFT");
  });

  test("fee summary page loads for exam officer", async ({ page }) => {
    await loginAs(page, "examOfficer");
    await page.goto("/exam-office/fee-summary");
    await expect(page.getByRole("heading", { name: "Fee Summary" })).toBeVisible();
    await expect(page.getByText("Total Candidates")).toBeVisible();
  });

  test("fee details page loads for exam officer", async ({ page }) => {
    await loginAs(page, "examOfficer");
    await page.goto(
      `/exam-office/fee-details?registrationWindowId=${testIds.windowClosed}`,
    );
    await expect(page.getByRole("heading", { name: "Fee Details" })).toBeVisible();
  });

  test("export buttons exist and return files", async ({ request }) => {
    const cookie = await loginViaApi(request, "examOfficer");

    const summaryCsv = await request.get("/api/fees/export?type=summary&format=csv", {
      headers: authHeaders(cookie),
    });
    expect(summaryCsv.ok()).toBeTruthy();
    expect(summaryCsv.headers()["content-type"]).toContain("text/csv");

    const summaryXlsx = await request.get("/api/fees/export?type=summary&format=xlsx", {
      headers: authHeaders(cookie),
    });
    expect(summaryXlsx.ok()).toBeTruthy();
    expect(summaryXlsx.headers()["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const detailsCsv = await request.get(
      `/api/fees/export?type=details&format=csv&registrationWindowId=${testIds.windowClosed}`,
      { headers: authHeaders(cookie) },
    );
    expect(detailsCsv.ok()).toBeTruthy();
    expect(detailsCsv.headers()["content-type"]).toContain("text/csv");
  });

  test("fee export page shows download links", async ({ page }) => {
    await loginAs(page, "examOfficer");
    await page.goto("/exam-office/fees/export");
    await expect(page.getByRole("heading", { name: "Export Fees" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Export CSV" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Export Excel" }).first()).toBeVisible();
  });
});
