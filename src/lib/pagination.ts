export const LIST_PAGE_SIZES = [50, 100] as const;
export const TEACHER_STUDENT_PAGE_SIZES = [25, 50, 100] as const;

export function parseListPagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const rawSize = Number(searchParams.get("pageSize") ?? "50") || 50;
  const pageSize = LIST_PAGE_SIZES.includes(rawSize as (typeof LIST_PAGE_SIZES)[number])
    ? rawSize
    : 50;
  return { page, pageSize };
}

export function parseTeacherStudentPagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const rawSize = Number(searchParams.get("pageSize") ?? "25") || 25;
  const pageSize = TEACHER_STUDENT_PAGE_SIZES.includes(
    rawSize as (typeof TEACHER_STUDENT_PAGE_SIZES)[number],
  )
    ? rawSize
    : 25;
  return { page, pageSize };
}

export function buildPaginationMeta(total: number, page: number, pageSize: number) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);
  const skip = (safePage - 1) * pageSize;
  return { page: safePage, pageSize, total, totalPages, skip };
}
