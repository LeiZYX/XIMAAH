/**
 * Diagnose unmatched IAL bulk-entry names against Candidate records.
 * Usage: npx tsx scripts/check-unmatched-uci.ts
 */
import { prisma } from "../src/lib/prisma";

const names: Array<[string, string]> = [
  ["XINYI", "HE"],
  ["XIANZHI", "ZHOU"],
  ["YUTONG", "HAN"],
  ["HONG TING JOHNNY", "ZHENG"],
  ["XINFEI", "CUI"],
  ["XUANHAO", "GAO"],
  ["JIYING", "WANG"],
  ["YUHAO", "ZHOU"],
  ["PINJIA", "ZHU"],
  ["KEXIN", "HU"],
  ["QINGRU", "XU"],
  ["ZHICHEN", "YAO"],
  ["YUSHU", "ZHOU"],
  ["YIWEN", "ZHU"],
  ["RUIYAN", "JIN"],
];

async function main() {
  for (const [f, l] of names) {
    const q = `${f} ${l}`;
    const rows = await prisma.candidate.findMany({
      where: {
        OR: [
          { englishName: { contains: f } },
          { firstName: { contains: f.split(" ")[0]! } },
          { lastName: { contains: l } },
          { legalEnglishName: { contains: l } },
        ],
      },
      select: {
        englishName: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        studentNumber: true,
        assessmentHubCandidateNumber: true,
      },
      take: 5,
    });
    console.log("\n===", q, "===");
    console.log(rows.length ? rows : "NO CANDIDATE HIT");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
