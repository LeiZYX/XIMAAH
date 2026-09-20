import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth/require-auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { getFeatureSettings, saveFeatureSettings } from "@/lib/features/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  try {
    const settings = await getFeatureSettings();
    return NextResponse.json({
      settings: {
        studentLoginEnabled: settings.studentLoginEnabled,
        updatedAt: settings.updatedAt?.toISOString() ?? null,
        updatedByName: settings.updatedByName,
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load feature settings",
      500,
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!canManageUsers(auth.user.role)) return jsonError("Forbidden", 403);

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON body", 400);
  const data = parseJsonBody<{ studentLoginEnabled?: boolean }>(body, []);
  if (!data) return jsonError("Invalid request body", 400);

  if (data.studentLoginEnabled !== undefined && typeof data.studentLoginEnabled !== "boolean") {
    return jsonError("studentLoginEnabled must be a boolean", 400);
  }

  try {
    const settings = await saveFeatureSettings(data, auth.user.id);
    return NextResponse.json({
      settings: {
        studentLoginEnabled: settings.studentLoginEnabled,
        updatedAt: settings.updatedAt?.toISOString() ?? null,
        updatedByName: settings.updatedByName,
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to save feature settings",
      500,
    );
  }
}
