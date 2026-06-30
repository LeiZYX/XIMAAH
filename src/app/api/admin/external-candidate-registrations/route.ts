import { NextRequest } from "next/server";
import { createExternalCandidateRegistrationHandler } from "@/lib/registrations/staff-registration-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  return createExternalCandidateRegistrationHandler(request);
}
