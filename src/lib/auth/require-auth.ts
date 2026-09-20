import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import type { UserRole } from "@/lib/auth/constants";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { studentLoginDisabledResponse } from "@/lib/features/settings";

export async function requireAuth(roles?: UserRole[]): Promise<
  | { user: SessionUser; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: jsonError("Authentication required", 401) };
  }

  const disabled = await studentLoginDisabledResponse(user.role);
  if (disabled) {
    return { user: null, error: disabled };
  }

  if (roles && !roles.includes(user.role)) {
    return { user: null, error: jsonError("Forbidden", 403) };
  }

  return { user, error: null };
}
