import { NextRequest } from "next/server";
import { createAssistedHandler } from "@/lib/registrations/staff-registration-api";

export async function POST(request: NextRequest) {
  return createAssistedHandler(request, "ADMIN");
}
