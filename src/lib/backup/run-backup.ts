import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { access } from "node:fs/promises";
import type { BackupTriggeredBy } from "@/generated/prisma/client";
import { logBackupAudit } from "@/lib/backup/audit";
import { getMysqlConnectionConfig } from "@/lib/backup/db-connection";
import { applyBackupRetention, buildBackupFileName } from "@/lib/backup/retention";
import { getResolvedBackupSettings } from "@/lib/backup/settings";
import { prisma } from "@/lib/prisma";

export interface RunBackupResult {
  jobId: string;
  status: "SUCCESS" | "FAILED";
  fileName?: string;
  fileSizeBytes?: number;
  errorMessage?: string;
}

async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function dumpViaMysqldump(
  outputPath: string,
  config: ReturnType<typeof getMysqlConnectionConfig>,
): Promise<void> {
  const args = [
    `-h${config.host}`,
    `-P${String(config.port)}`,
    `-u${config.user}`,
    `--single-transaction`,
    "--routines",
    "--triggers",
    config.database,
  ];

  const mysqldump = spawn("mysqldump", args, {
    env: { ...process.env, MYSQL_PWD: config.password },
  });

  const gzip = createGzip();
  const output = createWriteStream(outputPath);
  let stderr = "";

  mysqldump.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const dumpClosed = new Promise<void>((resolve, reject) => {
    mysqldump.on("error", reject);
    mysqldump.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `mysqldump exited with code ${code}`));
    });
  });

  await Promise.all([pipeline(mysqldump.stdout, gzip, output), dumpClosed]);
}

async function dumpViaDockerCompose(
  outputPath: string,
  database: string,
): Promise<void> {
  const composeFile =
    process.env.BACKUP_DOCKER_COMPOSE_FILE?.trim() ||
    (process.env.NODE_ENV === "development" ? "docker-compose.dev.yml" : "");
  const composeArgs = composeFile ? ["-f", composeFile] : [];
  const shellCommand =
    `mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers ${database}`;

  const docker = spawn(
    "docker",
    ["compose", ...composeArgs, "exec", "-T", "mysql", "sh", "-ec", shellCommand],
    { cwd: process.cwd() },
  );

  const gzip = createGzip();
  const output = createWriteStream(outputPath);
  let stderr = "";

  docker.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const dockerClosed = new Promise<void>((resolve, reject) => {
    docker.on("error", reject);
    docker.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `docker compose exec failed with code ${code}`));
    });
  });

  await Promise.all([pipeline(docker.stdout, gzip, output), dockerClosed]);
}

async function writeDatabaseBackup(outputPath: string): Promise<void> {
  const config = getMysqlConnectionConfig();
  const localHost =
    config.host === "localhost" || config.host === "127.0.0.1" || config.host === "::1";
  const preferDocker =
    process.env.BACKUP_PREFER_DOCKER === "1" ||
    (process.env.NODE_ENV === "development" && localHost);

  if (preferDocker && (await commandExists("docker"))) {
    await dumpViaDockerCompose(outputPath, config.database);
    return;
  }

  if (await commandExists("mysqldump")) {
    try {
      await dumpViaMysqldump(outputPath, config);
      return;
    } catch (error) {
      if (await commandExists("docker")) {
        await dumpViaDockerCompose(outputPath, config.database);
        return;
      }
      throw error;
    }
  }

  if (await commandExists("docker")) {
    await dumpViaDockerCompose(outputPath, config.database);
    return;
  }

  throw new Error(
    "Neither mysqldump nor docker compose is available to run database backup.",
  );
}

export async function runDatabaseBackup(input: {
  triggeredBy: BackupTriggeredBy;
  triggeredByUserId?: string | null;
  auditUserId?: string | null;
}): Promise<RunBackupResult> {
  const settings = await getResolvedBackupSettings();

  if (settings.backupType !== "DATABASE_ONLY") {
    throw new Error("Only DATABASE_ONLY backups are supported in this version.");
  }

  const fileName = buildBackupFileName();
  const filePath = path.join(settings.backupDirectory, fileName);

  const job = await prisma.backupJob.create({
    data: {
      backupType: settings.backupType,
      status: "PENDING",
      fileName,
      filePath,
      triggeredBy: input.triggeredBy,
      triggeredByUserId: input.triggeredByUserId ?? null,
    },
  });

  const auditUserId = input.auditUserId ?? input.triggeredByUserId;
  if (auditUserId && input.triggeredBy === "MANUAL") {
    await logBackupAudit({
      action: "BACKUP_MANUAL_STARTED",
      performedById: auditUserId,
      metadata: { jobId: job.id, fileName },
    });
  }

  await prisma.backupJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    await fs.mkdir(settings.backupDirectory, { recursive: true });
    await writeDatabaseBackup(filePath);
    await access(filePath);

    const stat = await fs.stat(filePath);
    if (stat.size === 0) {
      throw new Error("Backup file is empty.");
    }

    const retention = await applyBackupRetention(
      settings.backupDirectory,
      settings.retentionDays,
    );

    await prisma.backupJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        fileSizeBytes: BigInt(stat.size),
        completedAt: new Date(),
        errorMessage: retention.errors.length
          ? `Retention cleanup warnings: ${retention.errors.join("; ")}`
          : retention.deletedFiles.length
            ? `Retention cleanup removed ${retention.deletedFiles.length} file(s).`
            : null,
      },
    });

    if (auditUserId && input.triggeredBy === "MANUAL") {
      await logBackupAudit({
        action: "BACKUP_MANUAL_SUCCESS",
        performedById: auditUserId,
        metadata: {
          jobId: job.id,
          fileName,
          fileSizeBytes: stat.size,
          retentionDeleted: retention.deletedFiles,
        },
      });
    }

    return {
      jobId: job.id,
      status: "SUCCESS",
      fileName,
      fileSizeBytes: stat.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    await prisma.backupJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
      },
    });

    try {
      await fs.unlink(filePath);
    } catch {
      // ignore partial file cleanup errors
    }

    if (auditUserId && input.triggeredBy === "MANUAL") {
      await logBackupAudit({
        action: "BACKUP_MANUAL_FAILED",
        performedById: auditUserId,
        metadata: { jobId: job.id, fileName, error: message },
      });
    }

    return {
      jobId: job.id,
      status: "FAILED",
      errorMessage: message,
    };
  }
}
