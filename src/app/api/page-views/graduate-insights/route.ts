import { NextResponse } from "next/server";
import { getPageViews, incrementPageViews } from "@/lib/db";

const pageKey = "graduate-insights";

export async function GET() {
  return NextResponse.json(
    { views: await getPageViews(pageKey) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST() {
  return NextResponse.json(
    { views: await incrementPageViews(pageKey) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
