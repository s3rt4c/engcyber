import { NextRequest, NextResponse } from "next/server";
import { extractArticle, sanitizeExtractedContent } from "@/server/content/pipeline";
import { fetchValidatedText } from "@/server/security/safe-fetch";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { url?: string; title?: string; sourceId?: string; publishedAt?: string; category?: "cybersecurity_news" | "artificial_intelligence" | "my_content" };
    if (!body.url) return NextResponse.json({ error: "A URL is required." }, { status: 400 });
    const fetched = await fetchValidatedText(body.url);
    const date = body.publishedAt && !Number.isNaN(Date.parse(body.publishedAt)) ? new Date(body.publishedAt) : null;
    const raw = extractArticle({ feedItemId: body.sourceId ?? null, title: body.title ?? "", canonicalUrl: fetched.url, publishedAt: date, author: null, primaryCategory: body.category ?? "my_content", tags: [], contentType: "article", html: fetched.html });
    return NextResponse.json({ content: sanitizeExtractedContent(raw) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Article import failed." }, { status: 422 }); }
}
