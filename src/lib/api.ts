import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function parseJsonBody<T extends Record<string, unknown>>(
  body: unknown,
  required: (keyof T)[],
): T | null {
  if (!body || typeof body !== "object") return null;

  const record = body as Record<string, unknown>;
  for (const key of required) {
    const value = record[key as string];
    if (value === undefined || value === null || value === "") {
      return null;
    }
  }

  return record as T;
}

export function parseOptionalInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
