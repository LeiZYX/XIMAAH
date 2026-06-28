import { buildPaginationMeta } from "@/lib/pagination";
import {
  buildRegistrationWhere,
  type RegistrationListFilters,
} from "@/lib/registrations/filters";
import { registrationInclude } from "@/lib/registrations/include";
import { prisma } from "@/lib/prisma";

const registrationOrderBy = [{ lockedAt: "desc" as const }, { updatedAt: "desc" as const }];

export async function listAllRegistrations(filters: RegistrationListFilters) {
  return prisma.studentExamRegistration.findMany({
    where: buildRegistrationWhere(filters),
    include: registrationInclude,
    orderBy: registrationOrderBy,
  });
}

export async function listRegistrationsPaginated(
  filters: RegistrationListFilters,
  page = 1,
  pageSize = 50,
) {
  const where = buildRegistrationWhere(filters);
  const total = await prisma.studentExamRegistration.count({ where });
  const { skip, page: safePage, totalPages, pageSize: size } = buildPaginationMeta(
    total,
    page,
    pageSize,
  );

  const registrations = await prisma.studentExamRegistration.findMany({
    where,
    include: registrationInclude,
    orderBy: registrationOrderBy,
    skip,
    take: size,
  });

  return {
    registrations,
    total,
    page: safePage,
    pageSize: size,
    totalPages,
  };
}
