import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export default async function globalSetup() {
  const script = resolve(process.cwd(), "tests/scripts/reset-test-db.ts");
  const result = spawnSync("npx", ["tsx", script], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error("Failed to reset and seed test database");
  }
}
