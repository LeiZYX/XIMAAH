const BASE = "https://qualifications.pearson.com/content/dam/pdf/Support";

export interface EdexcelTimetableSource {
  id: string;
  label: string;
  url: string;
  seriesName: string;
  year: number;
  qualificationLevel: string;
}

export const EDEXCEL_TIMETABLES: EdexcelTimetableSource[] = [
  {
    id: "gcse-summer-2026",
    label: "GCSE — Summer 2026",
    url: `${BASE}/Examination-timetables-for-UK-Edexcel-GCSE/gcse-summer-2026-final.xlsx`,
    seriesName: "Summer 2026",
    year: 2026,
    qualificationLevel: "GCSE",
  },
  {
    id: "gcse-nov-2026",
    label: "GCSE — November 2026",
    url: `${BASE}/Examination-timetables-for-UK-Edexcel-GCSE/gcse-nov2026-final.xlsx`,
    seriesName: "November 2026",
    year: 2026,
    qualificationLevel: "GCSE",
  },
  {
    id: "gce-summer-2026",
    label: "AS & A Level — Summer 2026",
    url: `${BASE}/Examination-timetables/gce-summer-2026-final.xlsx`,
    seriesName: "Summer 2026",
    year: 2026,
    qualificationLevel: "GCE",
  },
  {
    id: "intl-gcse-summer-2026",
    label: "International GCSE — Summer 2026",
    url: `${BASE}/Examination-timetables-for-Edexcel-International-GCSE/int-gcse-summer-2026-final.xlsx`,
    seriesName: "Summer 2026",
    year: 2026,
    qualificationLevel: "International GCSE",
  },
  {
    id: "intl-gcse-nov-2026",
    label: "International GCSE — November 2026",
    url: `${BASE}/Examination-timetables-for-Edexcel-International-GCSE/intgcse-nov-2026-final.xlsx`,
    seriesName: "November 2026",
    year: 2026,
    qualificationLevel: "International GCSE",
  },
  {
    id: "ial-summer-2026",
    label: "International A Level — Summer 2026",
    url: `${BASE}/Examination-timetables-for-International-Advanced-Levels/ial-summer-2026-final.xlsx`,
    seriesName: "Summer 2026",
    year: 2026,
    qualificationLevel: "International A Level",
  },
  {
    id: "ial-october-2026",
    label: "International A Level — October 2026",
    url: `${BASE}/Examination-timetables-for-International-Advanced-Levels/ial-october2026-final.xlsx`,
    seriesName: "October 2026",
    year: 2026,
    qualificationLevel: "International Advanced Level",
  },
];

export function getEdexcelTimetable(id: string): EdexcelTimetableSource | undefined {
  return EDEXCEL_TIMETABLES.find((item) => item.id === id);
}

export async function downloadEdexcelTimetable(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    headers: { "User-Agent": "XIMA-Assessment-Hub/1.0" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Failed to download Edexcel timetable (${response.status})`);
  }

  return response.arrayBuffer();
}
