export async function readSubmitErrorMessage(
  response: Response,
  fallback = "Could not submit registration",
): Promise<string> {
  const rawText = await response.text();
  let data: Record<string, unknown> = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      data = { raw: rawText };
    }
  }

  console.error("Registration submit failed", {
    status: response.status,
    statusText: response.statusText,
    body: data,
  });

  const error =
    (typeof data.error === "string" && data.error) ||
    (typeof data.message === "string" && data.message) ||
    (rawText.trim() && !rawText.trim().startsWith("<") ? rawText.trim() : null);

  return error || fallback;
}

export function logRegistrationSubmitPayload(label: string, payload: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[registration submit] ${label}`, payload);
  }
}
