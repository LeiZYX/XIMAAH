import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

export function candidatePhotoUploadDir() {
  return path.join(process.cwd(), "public", "uploads", "candidates");
}

export function candidatePhotoPublicUrl(filename: string) {
  return `/uploads/candidates/${filename}`;
}

export async function saveCandidatePhoto(candidateId: string, file: File): Promise<string> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Photo must be JPG or PNG");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Photo must be 2MB or smaller");
  }

  const extension = file.type === "image/png" ? ".png" : ".jpg";
  const filename = `${candidateId}${extension}`;
  const uploadDir = candidatePhotoUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);

  for (const altExt of ALLOWED_EXTENSIONS) {
    if (altExt === extension) continue;
    const altPath = path.join(uploadDir, `${candidateId}${altExt}`);
    await unlink(altPath).catch(() => undefined);
  }

  return candidatePhotoPublicUrl(filename);
}

export async function removeCandidatePhotoFile(photoUrl: string | null | undefined) {
  if (!photoUrl?.startsWith("/uploads/candidates/")) return;
  const filename = photoUrl.replace("/uploads/candidates/", "");
  const filePath = path.join(candidatePhotoUploadDir(), filename);
  await unlink(filePath).catch(() => undefined);
}
