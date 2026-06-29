import { NextRequest } from "next/server";
import { createAssistedHandler } from "@/lib/registrations/staff-registration-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  return createAssistedHandler(request, "EXAM_OFFICER");
}
