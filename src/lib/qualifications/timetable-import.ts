import { prisma } from "@/lib/prisma";

export interface TimetableQualificationRow {
  qualificationLevel: string;
  syllabusCode: string;
  subject: string;
}

export interface TimetableSubjectResolution {
  subjectId: string;
  qualificationId: string;
  createdSubject: boolean;
  createdQualification: boolean;
}

/** Cache key for level-based qualifications (one per board + level). */
export function levelQualificationCacheKey(level: string): string {
  return level.trim();
}

/** Display name for a level-based qualification row. */
export function levelQualificationName(level: string): string {
  return level.trim();
}

/** Cache key for subjects scoped by exam board + syllabus code. */
export function subjectCacheKey(examBoardId: string, syllabusCode: string): string {
  return `${examBoardId}:${syllabusCode.trim()}`;
}

export async function ensureLevelBasedQualification(
  examBoardId: string,
  level: string,
  cache: Map<string, string>,
): Promise<{ id: string; created: boolean }> {
  const key = levelQualificationCacheKey(level);
  const cached = cache.get(key);
  if (cached) return { id: cached, created: false };

  const existing = await prisma.qualification.findFirst({
    where: {
      examBoardId,
      level: level.trim(),
      code: null,
    },
    select: { id: true },
  });

  if (existing) {
    cache.set(key, existing.id);
    return { id: existing.id, created: false };
  }

  const created = await prisma.qualification.create({
    data: {
      examBoardId,
      level: level.trim(),
      name: levelQualificationName(level),
      code: null,
    },
    select: { id: true },
  });

  cache.set(key, created.id);
  return { id: created.id, created: true };
}

/**
 * Resolve or create the subject for a timetable row.
 * Reuses existing board subjects (including legacy per-syllabus qualifications)
 * before creating new subjects under a level-based qualification.
 */
export async function resolveTimetableSubject(
  examBoardId: string,
  row: TimetableQualificationRow,
  qualificationCache: Map<string, string>,
  subjectCache: Map<string, string>,
): Promise<TimetableSubjectResolution> {
  const key = subjectCacheKey(examBoardId, row.syllabusCode);
  const cachedSubjectId = subjectCache.get(key);
  if (cachedSubjectId) {
    return {
      subjectId: cachedSubjectId,
      qualificationId: "",
      createdSubject: false,
      createdQualification: false,
    };
  }

  const existingSubject = await prisma.subject.findFirst({
    where: {
      code: row.syllabusCode.trim(),
      qualification: { examBoardId },
    },
    select: { id: true, qualificationId: true },
  });

  if (existingSubject) {
    subjectCache.set(key, existingSubject.id);
    return {
      subjectId: existingSubject.id,
      qualificationId: existingSubject.qualificationId,
      createdSubject: false,
      createdQualification: false,
    };
  }

  const qualification = await ensureLevelBasedQualification(
    examBoardId,
    row.qualificationLevel,
    qualificationCache,
  );

  const createdSubject = await prisma.subject.create({
    data: {
      qualificationId: qualification.id,
      name: row.subject.trim(),
      code: row.syllabusCode.trim(),
    },
    select: { id: true },
  });

  subjectCache.set(key, createdSubject.id);
  return {
    subjectId: createdSubject.id,
    qualificationId: qualification.id,
    createdSubject: true,
    createdQualification: qualification.created,
  };
}
