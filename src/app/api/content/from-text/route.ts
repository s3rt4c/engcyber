import { sanitizeExtractedContent } from "@/server/content/pipeline";
import { apiError, apiJson } from "@/server/api-response";
import { readProtectedRouteJson } from "@/server/request-security";

export async function POST(request: Request) {
  try {
    const body = await readProtectedRouteJson<{ title?: string; text?: string }>(request, "contentFromText");
    if (!body.text?.trim()) return apiJson({ error: "Paste article text to continue." }, { status: 400 });
    return apiJson({ content: sanitizeExtractedContent({ feedItemId: null, title: body.title?.trim() || "My content", canonicalUrl: null, publishedAt: null, author: null, primaryCategory: "my_content", tags: [], contentType: "manual", rawText: body.text, externalInputTrust: "untrusted" }) });
  } catch (error) { return apiError(error, "Malformed request.", 400); }
}
