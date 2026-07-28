import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { logAiRequest, saveGeneratedCv, saveProfile } from "@/lib/db";
import { generateGeminiJson, geminiModel } from "@/lib/gemini";
import { fallbackCv, normalizeCvDocument, normalizeProfile } from "@/lib/profile";
import { tailoringPrompt } from "@/lib/prompts";
import { generateCvSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  try {
    const body = generateCvSchema.parse(await request.json());
    const profile = normalizeProfile(body.profile);
    await saveProfile(user.id, profile);

    let cv = fallbackCv(profile, body.jobTitle);
    try {
      const result = await generateGeminiJson(tailoringPrompt(profile, body.jobTitle, body.jobDescription, body.template));
      cv = normalizeCvDocument(result);
      await logAiRequest(user.id, "job-specific-cv", geminiModel(), true);
    } catch (error) {
      await logAiRequest(user.id, "job-specific-cv", geminiModel(), false, error instanceof Error ? error.message : "AI failed");
    }

    const id = await saveGeneratedCv(user.id, cv.title, body.jobTitle, body.template, body.jobDescription, cv);
    return NextResponse.json({ id, cv });
  } catch (error) {
    return errorResponse(error, "Could not generate CV.", 400);
  }
}
