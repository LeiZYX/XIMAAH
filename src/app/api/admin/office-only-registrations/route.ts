import { NextRequest } from "next/server";
import { createOfficeOnlyInternalHandler } from "@/lib/registrations/staff-registration-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  return createOfficeOnlyInternalHandler(request, "ADMIN");
}
