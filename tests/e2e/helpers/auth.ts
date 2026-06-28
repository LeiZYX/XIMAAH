import type { APIRequestContext, Page } from "@playwright/test";
import { TEST_PASSWORD, accountFor, type TestRole } from "../fixtures/test-data";

export async function loginViaApi(
  request: APIRequestContext,
  role: TestRole,
): Promise<string> {
  const account = accountFor(role);
  const response = await request.post("/api/auth/login", {
    data: {
      identifier: account.identifier,
      password: TEST_PASSWORD,
    },
  });

  if (!response.ok()) {
    throw new Error(`Login failed for ${role}: ${response.status()} ${await response.text()}`);
  }

  const setCookie = response.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie");
  const session = setCookie
    .map((h) => h.value.split(";")[0])
    .find((value) => value.startsWith("xima_session="));

  if (!session) {
    throw new Error(`Missing session cookie for ${role}`);
  }

  return session;
}

export async function loginAs(page: Page, role: TestRole) {
  const account = accountFor(role);
  await page.goto("/login");
  await page.getByLabel("Identifier").fill(account.identifier);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`**${account.homePath}**`);
}

export async function apiContextWithRole(
  request: APIRequestContext,
  role: TestRole,
): Promise<{ cookie: string }> {
  const cookie = await loginViaApi(request, role);
  return { cookie };
}

export function authHeaders(cookie: string) {
  return { Cookie: cookie };
}
