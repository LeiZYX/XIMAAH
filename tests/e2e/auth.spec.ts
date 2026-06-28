import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Login and role-based access", () => {
  test("admin can access admin dashboard", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("exam officer can access exam office dashboard", async ({ page }) => {
    await loginAs(page, "examOfficer");
    await expect(page).toHaveURL(/\/exam-office/);
  });

  test("teacher can access teacher dashboard", async ({ page }) => {
    await loginAs(page, "teacher");
    await expect(page).toHaveURL(/\/teacher/);
  });

  test("internal student can access student dashboard", async ({ page }) => {
    await loginAs(page, "internalStudent");
    await expect(page).toHaveURL(/\/student/);
  });

  test("student cannot access admin area", async ({ page }) => {
    await loginAs(page, "internalStudent");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/student/);
  });

  test("teacher cannot access exam office area", async ({ page }) => {
    await loginAs(page, "teacher");
    await page.goto("/exam-office");
    await expect(page).toHaveURL(/\/teacher/);
  });
});
