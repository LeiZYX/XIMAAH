import type { PrismaClient } from "../src/generated/prisma/client";

const DEFAULT_EXAM_BOARDS = [
  {
    code: "EDEXCEL",
    name: "Pearson Edexcel",
    description: "Pearson Edexcel qualifications",
    country: "GB",
    region: "United Kingdom",
    timezone: "Europe/London",
    website: "https://qualifications.pearson.com",
  },
  {
    code: "CIE",
    name: "Cambridge International",
    description: "Cambridge Assessment International Education (IGCSE, AS & A Level)",
    country: "GB",
    region: "International",
    timezone: "Europe/London",
    website: "https://www.cambridgeinternational.org",
  },
  {
    code: "AQA",
    name: "AQA",
    description: "Leading exam board for GCSEs and A-Levels in England",
    country: "GB",
    region: "United Kingdom",
    timezone: "Europe/London",
    website: "https://www.aqa.org.uk",
  },
] as const;

export async function ensureDefaultExamBoards(prisma: PrismaClient) {
  const existingCount = await prisma.examBoard.count();

  if (existingCount === 0) {
    await prisma.examBoard.createMany({
      data: DEFAULT_EXAM_BOARDS.map((board) => ({ ...board })),
    });
  } else {
    for (const board of DEFAULT_EXAM_BOARDS) {
      await prisma.examBoard.upsert({
        where: { code: board.code },
        update: {
          name: board.name,
          country: board.country,
          region: board.region,
          timezone: board.timezone,
          website: board.website,
          description: board.description,
        },
        create: { ...board },
      });
    }
  }

  await prisma.examBoard.deleteMany({ where: { code: "EDX" } });

  const [edexcel, cie, aqa] = await Promise.all([
    prisma.examBoard.findUniqueOrThrow({ where: { code: "EDEXCEL" } }),
    prisma.examBoard.findUniqueOrThrow({ where: { code: "CIE" } }),
    prisma.examBoard.findUniqueOrThrow({ where: { code: "AQA" } }),
  ]);

  return { aqa, cie, edexcel };
}
