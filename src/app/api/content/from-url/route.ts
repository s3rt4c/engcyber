import { extractArticle, sanitizeExtractedContent } from "@/server/content/pipeline";
import { apiError, apiJson } from "@/server/api-response";
import { readProtectedRouteJson } from "@/server/request-security";
import { fetchValidatedText } from "@/server/security/safe-fetch";

export async function POST(request: Request) {
  try {
    const body = await readProtectedRouteJson<{ url?: string; title?: string; sourceId?: string; publishedAt?: string; category?: "cybersecurity_news" | "artificial_intelligence" | "my_content" }>(request, "contentFromUrl");
    if (!body.url) return apiJson({ error: "A URL is required." }, { status: 400 });
    const fetched = await fetchValidatedText(body.url);
    const date = body.publishedAt && !Number.isNaN(Date.parse(body.publishedAt)) ? new Date(body.publishedAt) : null;
    const raw = extractArticle({ feedItemId: body.sourceId ?? null, title: body.title ?? "", canonicalUrl: fetched.url, publishedAt: date, author: null, primaryCategory: body.category ?? "my_content", tags: [], contentType: "article", html: fetched.html });
    return apiJson({ content: sanitizeExtractedContent(raw) });
  } catch (error) {
    return apiError(error, "This URL could not be imported safely.", 422);
  }
}
