import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { createCandidateAuditLog } from "@/lib/candidates/audit";
import { updateCandidate } from "@/lib/candidates/import";
import { getCandidateById } from "@/lib/candidates/list";
import { removeCandidatePhotoFile, saveCandidatePhoto } from "@/lib/candidates/photo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(["ADMIN", "EXAM_OFFICER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const candidate = await getCandidateById(id);
  if (!candidate) return jsonError("Candidate not found", 404);

  const formData = await request.formData();
  const action = String(formData.get("action") ?? "upload");

  try {
    if (action === "remove") {
      await removeCandidatePhotoFile(candidate.photoUrl);
      await updateCandidate(id, { photoUrl: null });
      await createCandidateAuditLog({
        candidateId: id,
        action: "CANDIDATE_PHOTO_REMOVED",
        performedById: auth.user.id,
      });
      return NextResponse.json(await getCandidateById(id));
    }

    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return jsonError("photo file is required", 400);
    }

    const photoUrl = await saveCandidatePhoto(id, file);
    await updateCandidate(id, { photoUrl });
    await createCandidateAuditLog({
      candidateId: id,
      action: "CANDIDATE_PHOTO_UPLOADED",
      performedById: auth.user.id,
      metadata: { photoUrl },
    });

    return NextResponse.json(await getCandidateById(id));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Photo upload failed", 500);
  }
}
