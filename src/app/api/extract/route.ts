import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { logAiRequest, saveUploadedDocument } from "@/lib/db";
import { generateGeminiJson, geminiModel } from "@/lib/gemini";
import { extractionMissingInformation, mergeExtractedProfiles, parseCvText, repairExtractedProfile } from "@/lib/cv-text-parser";
import { extractionPrompt } from "@/lib/prompts";
import { normalizeProfile, unique } from "@/lib/profile";

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
    const parsedProfile = parseCvText(extractedText);

    let result: ExtractionResult;
    try {
      result = await generateGeminiJson<ExtractionResult>(extractionPrompt(extractedText));
      await logAiRequest(user.id, "cv-extraction", geminiModel(), true);
    } catch (error) {
      await logAiRequest(user.id, "cv-extraction", geminiModel(), false, error instanceof Error ? error.message : "AI failed");
      result = { profile: parsedProfile, missingInformation: ["Review extracted details before saving."] };
    }

    const extractedProfile = repairExtractedProfile(mergeExtractedProfiles(normalizeProfile(result.profile), parsedProfile));

    return NextResponse.json({
      extractedProfile,
      missingInformation: unique([
        ...(Array.isArray(result.missingInformation) ? result.missingInformation : []),
        ...extractionMissingInformation(extractedProfile),
      ]),
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
