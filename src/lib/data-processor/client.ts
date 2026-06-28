import type {
  ImportPreviewResponseDto,
  ImportPreviewSource,
  ParseResponseDto,
  TimetableMetaDto,
  TimetableRowDto,
} from "@/lib/data-processor/types";

export class DataProcessorError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "DataProcessorError";
  }
}

function baseUrl(): string {
  const url = process.env.DATA_PROCESSOR_URL;
  if (!url) {
    throw new DataProcessorError(
      "DATA_PROCESSOR_URL is not configured. Start the Python data-processor service.",
      503,
    );
  }
  return url.replace(/\/$/, "");
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((item: { msg?: string }) => item.msg ?? "Validation error").join("; ");
    }
    if (typeof data.error === "string") return data.error;
  } catch {
    // ignore
  }
  return `Data processor request failed (${response.status})`;
}

export async function parsePearsonExcel(file: File): Promise<ParseResponseDto> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${baseUrl()}/parse/pearson-excel`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new DataProcessorError(await readError(response), response.status);
  }

  return response.json();
}

export async function parseCambridgePdf(file: File): Promise<ParseResponseDto> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${baseUrl()}/parse/cambridge-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new DataProcessorError(await readError(response), response.status);
  }

  return response.json();
}

export async function parseOxfordAqaPdf(file: File): Promise<ParseResponseDto> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${baseUrl()}/parse/oxfordaqa-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new DataProcessorError(await readError(response), response.status);
  }

  return response.json();
}

export async function validateImportPreview(payload: {
  source: ImportPreviewSource;
  rows: TimetableRowDto[];
  meta: TimetableMetaDto;
}): Promise<ImportPreviewResponseDto> {
  const response = await fetch(`${baseUrl()}/validate/import-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new DataProcessorError(await readError(response), response.status);
  }

  return response.json();
}

export async function checkDataProcessorHealth(): Promise<boolean> {
  try {
    const url = process.env.DATA_PROCESSOR_URL;
    if (!url) return false;
    const response = await fetch(`${url.replace(/\/$/, "")}/health`, {
      next: { revalidate: 0 },
    });
    return response.ok;
  } catch {
    return false;
  }
}
