import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { listJobSyncRuns, listRecommendedJobs } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  try {
    return NextResponse.json({
      recommendations: await listRecommendedJobs(user.id),
      syncRuns: await listJobSyncRuns(),
    });
  } catch (error) {
    return errorResponse(error, "Could not load recommendations.");
  }
}
