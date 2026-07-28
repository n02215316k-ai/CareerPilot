import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { logAiRequest } from "@/lib/db";
import { generateGeminiJson, geminiModel } from "@/lib/gemini";
import { interviewPrompt } from "@/lib/prompts";
import { normalizeProfile } from "@/lib/profile";
import { careerProfileSchema } from "@/lib/schemas";
import type { CareerProfile } from "@/lib/types";

type InterviewResult = {
  questions?: string[];
};

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  try {
    const profile = normalizeProfile(careerProfileSchema.parse(await request.json()));
    let questions: string[];

    try {
      const result = await generateGeminiJson<InterviewResult>(interviewPrompt(profile));
      questions = Array.isArray(result.questions) ? result.questions : [];
      await logAiRequest(user.id, "missing-information", geminiModel(), true);
    } catch (error) {
      await logAiRequest(user.id, "missing-information", geminiModel(), false, error instanceof Error ? error.message : "AI failed");
      questions = fallbackQuestions(profile);
    }

    return NextResponse.json({ questions });
  } catch (error) {
    return errorResponse(error, "Could not inspect profile.", 400);
  }
}

function fallbackQuestions(profile: CareerProfile) {
  const questions: string[] = [];
  if (!profile.targetRoles.length) questions.push("Which job titles are you targeting first?");
  if (!profile.professionalSummary) questions.push("What is the strongest one-paragraph summary of your background?");
  if (!profile.experience.length) questions.push("Do you have employment, internship, attachment or volunteer experience to add?");
  if (profile.experience.some((item) => !item.bullets.length)) questions.push("What responsibilities and tools should be added to each experience entry?");
  if (!profile.projects.length) questions.push("Which practical projects best show your skills?");
  if (!profile.skills.technical.length) questions.push("Which technical skills or tools should be listed?");
  return questions.slice(0, 8);
}
