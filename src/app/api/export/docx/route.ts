import type { NextRequest } from "next/server";
import { createFirstJobTemplateDocx } from "@/lib/docx-template";
import { normalizeCvDocument } from "@/lib/profile";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cv = normalizeCvDocument(await request.json());
  const docx = await createFirstJobTemplateDocx(cv);
  return new Response(new Uint8Array(docx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeFilename(cv.title)}.docx"`,
    },
  });
}

function safeFilename(value: string) {
  return (value || "careerpilot-cv").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
