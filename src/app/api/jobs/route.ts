import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { listJobs, listJobSyncRuns } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  try {
    const url = new URL(request.url);
    const jobs = await listJobs({
      search: url.searchParams.get("search") || "",
      source: url.searchParams.get("source") || "all",
      location: url.searchParams.get("location") || "",
      limit: Number(url.searchParams.get("limit") || 80),
    });
    return NextResponse.json({ jobs, syncRuns: await listJobSyncRuns() });
  } catch (error) {
    return errorResponse(error, "Could not load jobs.");
  }
}
