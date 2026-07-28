import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { updateGeneratedCv } from "@/lib/db";
import { normalizeCvDocument } from "@/lib/profile";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  try {
    const { id } = await params;
    const cv = normalizeCvDocument(await request.json());
    const updated = await updateGeneratedCv(user.id, id, cv.title, cv);
    if (!updated) {
      return NextResponse.json({ error: "CV version not found." }, { status: 404 });
    }
    return NextResponse.json({ cv });
  } catch (error) {
    return errorResponse(error, "Could not save CV edits.", 400);
  }
}
