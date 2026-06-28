/**
 * MySQL (utf8mb4_unicode_ci) compares strings case-insensitively at the database level.
 * Use these helpers instead of Prisma's PostgreSQL-only `mode: "insensitive"`.
 */
export function equalsFilter(value: string) {
  return { equals: value };
}

export function containsFilter(value: string) {
  return { contains: value };
}
