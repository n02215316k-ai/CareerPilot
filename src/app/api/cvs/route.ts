import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { listGeneratedCvs } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  try {
    return NextResponse.json({ cvs: await listGeneratedCvs(user.id) });
  } catch (error) {
    return errorResponse(error, "Could not load generated CVs.");
  }
}
