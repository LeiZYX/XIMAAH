import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureLevelBasedQualification,
  levelQualificationCacheKey,
  levelQualificationName,
  resolveTimetableSubject,
  subjectCacheKey,
} from "@/lib/qualifications/timetable-import";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    qualification: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    subject: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockedPrisma = prisma as unknown as {
  qualification: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  subject: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

describe("timetable import helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds stable cache keys", () => {
    expect(levelQualificationCacheKey(" GCE A Level ")).toBe("GCE A Level");
    expect(levelQualificationName("International A Level")).toBe("International A Level");
    expect(subjectCacheKey("board-1", "9BI0")).toBe("board-1:9BI0");
  });

  it("creates a level-based qualification when none exists", async () => {
    mockedPrisma.qualification.findFirst.mockResolvedValue(null);
    mockedPrisma.qualification.create.mockResolvedValue({ id: "qual-level" });

    const cache = new Map<string, string>();
    const result = await ensureLevelBasedQualification(
      "board-1",
      "GCE A Level",
      cache,
    );

    expect(result).toEqual({ id: "qual-level", created: true });
    expect(mockedPrisma.qualification.create).toHaveBeenCalledWith({
      data: {
        examBoardId: "board-1",
        level: "GCE A Level",
        name: "GCE A Level",
        code: null,
      },
      select: { id: true },
    });
    expect(cache.get("GCE A Level")).toBe("qual-level");
  });

  it("reuses an existing level-based qualification", async () => {
    mockedPrisma.qualification.findFirst.mockResolvedValue({ id: "qual-existing" });

    const cache = new Map<string, string>();
    const result = await ensureLevelBasedQualification(
      "board-1",
      "GCE A Level",
      cache,
    );

    expect(result).toEqual({ id: "qual-existing", created: false });
    expect(mockedPrisma.qualification.create).not.toHaveBeenCalled();
  });

  it("reuses legacy board subjects before creating level-based qualifications", async () => {
    mockedPrisma.subject.findFirst.mockResolvedValue({
      id: "subject-legacy",
      qualificationId: "qual-syllabus",
    });

    const qualificationCache = new Map<string, string>();
    const subjectCache = new Map<string, string>();
    const result = await resolveTimetableSubject(
      "board-1",
      {
        qualificationLevel: "GCE A Level",
        syllabusCode: "9BI0",
        subject: "Biology",
      },
      qualificationCache,
      subjectCache,
    );

    expect(result).toEqual({
      subjectId: "subject-legacy",
      qualificationId: "qual-syllabus",
      createdSubject: false,
      createdQualification: false,
    });
    expect(mockedPrisma.qualification.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.subject.create).not.toHaveBeenCalled();
    expect(subjectCache.get("board-1:9BI0")).toBe("subject-legacy");
  });

  it("creates new subjects under a level-based qualification", async () => {
    mockedPrisma.subject.findFirst.mockResolvedValue(null);
    mockedPrisma.qualification.findFirst.mockResolvedValue(null);
    mockedPrisma.qualification.create.mockResolvedValue({ id: "qual-level" });
    mockedPrisma.subject.create.mockResolvedValue({ id: "subject-new" });

    const qualificationCache = new Map<string, string>();
    const subjectCache = new Map<string, string>();
    const result = await resolveTimetableSubject(
      "board-1",
      {
        qualificationLevel: "GCE A Level",
        syllabusCode: "9CH0",
        subject: "Chemistry",
      },
      qualificationCache,
      subjectCache,
    );

    expect(result).toEqual({
      subjectId: "subject-new",
      qualificationId: "qual-level",
      createdSubject: true,
      createdQualification: true,
    });
    expect(mockedPrisma.subject.create).toHaveBeenCalledWith({
      data: {
        qualificationId: "qual-level",
        name: "Chemistry",
        code: "9CH0",
      },
      select: { id: true },
    });
  });

  it("uses subject cache on repeated rows without extra database calls", async () => {
    const qualificationCache = new Map<string, string>();
    const subjectCache = new Map<string, string>([["board-1:9BI0", "subject-cached"]]);

    const result = await resolveTimetableSubject(
      "board-1",
      {
        qualificationLevel: "GCE A Level",
        syllabusCode: "9BI0",
        subject: "Biology",
      },
      qualificationCache,
      subjectCache,
    );

    expect(result.subjectId).toBe("subject-cached");
    expect(mockedPrisma.subject.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.qualification.findFirst).not.toHaveBeenCalled();
  });
});
