import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

config({ path: resolve(process.cwd(), ".env.test") });

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl.includes("_test") && !databaseUrl.includes("test")) {
  console.error(
    "Refusing to reset database: DATABASE_URL must point to a test database (name should contain 'test').",
  );
  console.error(`Current DATABASE_URL: ${databaseUrl.replace(/:[^:@/]+@/, ":***@")}`);
  process.exit(1);
}

async function resetSchema() {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    console.log("Dropping and recreating public schema on test database...");
    await pool.query(`DROP SCHEMA IF EXISTS public CASCADE`);
    await pool.query(`CREATE SCHEMA public`);
    await pool.query(`GRANT ALL ON SCHEMA public TO public`);
  } finally {
    await pool.end();
  }
}

async function main() {
  await resetSchema();

  console.log("Applying schema...");
  const push = spawnSync("npx", ["prisma", "db", "push"], {
    stdio: "inherit",
    env: process.env,
  });

  if (push.status !== 0) {
    process.exit(push.status ?? 1);
  }

  console.log("Seeding test database...");
  const seed = spawnSync("npx", ["tsx", "prisma/seed-test.ts"], {
    stdio: "inherit",
    env: process.env,
  });

  process.exit(seed.status ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
