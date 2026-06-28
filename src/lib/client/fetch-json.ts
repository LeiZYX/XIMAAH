export async function readJsonResponse<T = Record<string, unknown>>(
  response: Response,
): Promise<T> {
  const text = await response.text();
  if (!text) {
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.ok
        ? "Invalid server response"
        : `Request failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }
}
