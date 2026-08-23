import { NextRequest, NextResponse } from "next/server";
import { sanitizeExtractedContent } from "@/server/content/pipeline";

export async function POST(request: NextRequest) {
  const body = await request.json() as { title?: string; text?: string };
  if (!body.text?.trim()) return NextResponse.json({ error: "Paste article text to continue." }, { status: 400 });
  return NextResponse.json({ content: sanitizeExtractedContent({ feedItemId: null, title: body.title?.trim() || "My content", canonicalUrl: null, publishedAt: null, author: null, primaryCategory: "my_content", tags: [], contentType: "manual", rawText: body.text, externalInputTrust: "untrusted" }) });
}
