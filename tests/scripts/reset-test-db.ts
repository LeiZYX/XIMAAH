import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { resolve } from "node:path";
import mariadb from "mariadb";

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
  const config = parseMysqlUrl(databaseUrl);
  const connection = await mariadb.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true,
  });

  try {
    console.log(`Dropping and recreating MySQL database "${config.database}"...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${config.database}\``);
    await connection.query(
      `CREATE DATABASE \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
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
