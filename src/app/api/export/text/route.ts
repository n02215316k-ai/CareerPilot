import type { NextRequest } from "next/server";
import { cvToPlainText, normalizeCvDocument } from "@/lib/profile";

export async function POST(request: NextRequest) {
  const cv = normalizeCvDocument(await request.json());
  return new Response(cvToPlainText(cv), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(cv.title)}.txt"`,
    },
  });
}

function safeFilename(value: string) {
  return (value || "careerpilot-cv").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
