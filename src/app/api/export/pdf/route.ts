import type { NextRequest } from "next/server";
import { createTemplatePdf } from "@/lib/libreoffice";
import { normalizeCvDocument } from "@/lib/profile";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cv = normalizeCvDocument(await request.json());
  const pdf = await createTemplatePdf(cv);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(cv.title)}.pdf"`,
    },
  });
}

function safeFilename(value: string) {
  return (value || "careerpilot-cv").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
