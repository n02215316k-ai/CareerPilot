import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "./auth";

export async function requireUser(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return {
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
      user: null,
    };
  }
  return { response: null, user: session };
}

export function errorResponse(error: unknown, fallback = "Request failed.", status = 500) {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}
