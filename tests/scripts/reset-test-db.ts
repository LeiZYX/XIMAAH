import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

config({ path: resolve(process.cwd(), ".env.test") });

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl.includes("_test") && !databaseUrl.includes("test")) {
  console.error(
    "Refusing to reset database: DATABASE_URL must point to a test database (name should contain 'test').",
  );
  console.error(`Current DATABASE_URL: ${databaseUrl.replace(/:[^:@/]+@/, ":***@")}`);
  process.exit(1);
}

function parseMysqlUrl(url: string) {
  const parsed = new URL(url.replace(/^mysql:\/\//, "http://"));
  const database = parsed.pathname.replace(/^\//, "");
  if (!database) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

async function resetDatabase() {
  const dbConfig = parseMysqlUrl(databaseUrl);
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true,
  });

  try {
    console.log(`Dropping and recreating MySQL database "${dbConfig.database}"...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${dbConfig.database}\``);
    await connection.query(
      `CREATE DATABASE \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}

async function main() {
  await resetDatabase();

  console.log("Applying schema...");
  const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });

  if (migrate.status !== 0) {
    process.exit(migrate.status ?? 1);
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
