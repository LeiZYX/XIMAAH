import { describe, expect, it } from "vitest";
import { normalizeCandidateImportRow } from "@/lib/candidates/import";

describe("normalizeCandidateImportRow", () => {
  it("maps friendly headers including UCI and Cand No aliases", () => {
    const row = normalizeCandidateImportRow({
      "Candidate Type": "EXTERNAL",
      "Chinese Name": "张三",
      "Surname Pinyin": "ZHANG",
      "Given Name Pinyin": "San",
      Gender: "MALE",
      "Date of Birth": "2010-05-15",
      "Exam Board": "Pearson Edexcel",
      "Centre Number": "96834",
      "UCI Number": "96834B990001",
      "Cand No": "T00001",
    });

    expect(row.candidateType).toBe("EXTERNAL");
    expect(row.chineseName).toBe("张三");
    expect(row.surnamePinyin).toBe("ZHANG");
    expect(row.givenNamePinyin).toBe("San");
    expect(row.examBoard).toBe("Pearson Edexcel");
    expect(row.centreNumber).toBe("96834");
    expect(row.uci).toBe("96834B990001");
    expect(row.boardCandidateNumber).toBe("T00001");
  });
});
