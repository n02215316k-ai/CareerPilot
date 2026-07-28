import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { getProfile, logAiRequest, saveProfile, saveUploadedDocument } from "@/lib/db";
import { generateGeminiJson, geminiModel } from "@/lib/gemini";
import { extractionPrompt } from "@/lib/prompts";
import { mergeProfiles, normalizeProfile } from "@/lib/profile";

type ExtractionResult = {
  profile?: unknown;
  missingInformation?: string[];
};

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const pastedText = String(formData.get("pastedText") || "");
    const filename = file instanceof File ? file.name : "pasted-text.txt";
    const extractedText = [pastedText, file instanceof File ? await extractTextFromFile(file) : ""]
      .join("\n")
      .trim();

    if (extractedText.length < 20) {
      return NextResponse.json({ error: "Upload a readable CV file or paste CV text." }, { status: 400 });
    }

    await saveUploadedDocument(user.id, filename, extractedText.slice(0, 120000));

    let result: ExtractionResult;
    try {
      result = await generateGeminiJson<ExtractionResult>(extractionPrompt(extractedText));
      await logAiRequest(user.id, "cv-extraction", geminiModel(), true);
    } catch (error) {
      await logAiRequest(user.id, "cv-extraction", geminiModel(), false, error instanceof Error ? error.message : "AI failed");
      result = { profile: heuristicProfile(extractedText), missingInformation: ["Review extracted details before saving."] };
    }

    const currentProfile = await getProfile(user.id);
    const extractedProfile = normalizeProfile(result.profile);
    const merged = mergeProfiles(currentProfile, extractedProfile);
    await saveProfile(user.id, merged);

    return NextResponse.json({
      profile: merged,
      extractedProfile,
      missingInformation: Array.isArray(result.missingInformation) ? result.missingInformation : [],
    });
  } catch (error) {
    return errorResponse(error, "Could not extract the CV.", 400);
  }
}

async function extractTextFromFile(file: File) {
  if (file.size > 6 * 1024 * 1024) {
    throw new Error("File is too large. The current limit is 6MB.");
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = pdfParseModule.default;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const data = await mammoth.extractRawText({ buffer });
    return data.value;
  }

  return new TextDecoder("utf-8").decode(buffer);
}

function heuristicProfile(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] || "";
  const skillsLine = lines.find((line) => /skills|technologies|tools/i.test(line)) || "";

  return {
    personalDetails: {
      fullName: lines[0] || "",
      email,
      phone,
      location: "",
      linkedin: "",
      portfolio: "",
    },
    targetRoles: [],
    professionalSummary: "",
    education: [],
    experience: [],
    projects: [],
    skills: {
      technical: skillsLine.split(/[:,]/).slice(1).join(",").split(",").map((item) => item.trim()).filter(Boolean),
      tools: [],
      soft: [],
      languages: [],
    },
    certifications: [],
    achievements: [],
    references: "",
  };
}
