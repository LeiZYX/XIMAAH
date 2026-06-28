import { NextRequest } from "next/server";
import { createOfficeOnlyInternalHandler } from "@/lib/registrations/staff-registration-api";

export async function POST(request: NextRequest) {
  return createOfficeOnlyInternalHandler(request, "ADMIN");
}
