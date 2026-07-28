import type { NextRequest } from "next/server";
import { createCvPdf } from "@/lib/pdf";
import { normalizeCvDocument } from "@/lib/profile";

export async function POST(request: NextRequest) {
  const cv = normalizeCvDocument(await request.json());
  return new Response(createCvPdf(cv), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(cv.title)}.pdf"`,
    },
  });
}

function safeFilename(value: string) {
  return (value || "careerpilot-cv").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
