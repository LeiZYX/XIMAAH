import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { importAqaRows } from "@/lib/aqa/importer";
import { parseAqaTimetablePdf } from "@/lib/aqa/parser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("Upload an AQA timetable PDF as form field 'file'.");
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return jsonError("Only PDF files are supported for AQA import.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, meta } = await parseAqaTimetablePdf(buffer);

    if (rows.length === 0) {
      return jsonError("No timed exam rows found in the PDF.");
    }

    const result = await importAqaRows(meta, rows);
    return NextResponse.json(result);
  } catch (error) {
    console.error("AQA import failed:", error);
    return jsonError(error instanceof Error ? error.message : "AQA import failed", 500);
  }
}
