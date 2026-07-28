import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { getProfile, saveProfile } from "@/lib/db";
import { normalizeProfile } from "@/lib/profile";
import { careerProfileSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  try {
    return NextResponse.json({ profile: await getProfile(user.id) });
  } catch (error) {
    return errorResponse(error, "Could not load profile.");
  }
}

export async function PUT(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  try {
    const profile = normalizeProfile(careerProfileSchema.parse(await request.json()));
    await saveProfile(user.id, profile);
    return NextResponse.json({ profile });
  } catch (error) {
    return errorResponse(error, "Could not save profile.", 400);
  }
}
