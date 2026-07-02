export interface MysqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function getMysqlConnectionConfig(): MysqlConnectionConfig {
  const database =
    process.env.MYSQL_DATABASE?.trim() ||
    parseDatabaseFromUrl(process.env.DATABASE_URL) ||
    "xima_assessment_hub";

  const password = process.env.MYSQL_ROOT_PASSWORD?.trim();
  if (password) {
    return {
      host: process.env.MYSQL_HOST?.trim() || guessHostFromDatabaseUrl() || "mysql",
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: "root",
      password,
      database,
    };
  }

  const urlConfig = parseDatabaseUrl(process.env.DATABASE_URL);
  if (urlConfig) {
    return urlConfig;
  }

  throw new Error(
    "MySQL credentials are not configured. Set MYSQL_ROOT_PASSWORD or DATABASE_URL.",
  );
}

function parseDatabaseFromUrl(databaseUrl?: string): string | null {
  if (!databaseUrl) return null;
  try {
    const url = new URL(databaseUrl);
    const db = url.pathname.replace(/^\//, "");
    return db || null;
  } catch {
    return null;
  }
}

function guessHostFromDatabaseUrl(): string | null {
  if (!process.env.DATABASE_URL) return null;
  try {
    const url = new URL(process.env.DATABASE_URL);
    return url.hostname || null;
  } catch {
    return null;
  }
}

function parseDatabaseUrl(databaseUrl?: string): MysqlConnectionConfig | null {
  if (!databaseUrl) return null;
  try {
    const url = new URL(databaseUrl);
    const database = url.pathname.replace(/^\//, "").split("?")[0];
    if (!database) return null;
    return {
      host: url.hostname || "localhost",
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username || "root"),
      password: decodeURIComponent(url.password || ""),
      database,
    };
  } catch {
    return null;
  }
}
