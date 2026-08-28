import { isSentenceAction } from "@/domain/sentence-actions";
import { apiError, apiJson } from "@/server/api-response";
import { resolveAiRuntime } from "@/server/ai/runtime";
import { readProtectedRouteJson } from "@/server/request-security";

export async function POST(request: Request) {
  try {
    const body = await readProtectedRouteJson<{ action?: unknown; selectedText?: unknown; surroundingContext?: unknown }>(request, "actions");
    if (!isSentenceAction(body.action) || typeof body.selectedText !== "string") return apiJson({ error: "Select text and choose a supported action." }, { status: 400 });
    try {
      const provider = resolveAiRuntime(process.env, "sentence_action");
      return apiJson({ result: await provider.runSentenceAction({ action: body.action, selectedText: body.selectedText, surroundingContext: typeof body.surroundingContext === "string" ? body.surroundingContext : "" }) });
    } catch (error) { return apiError(error, "The upstream service is temporarily unavailable.", 503); }
  } catch (error) { return apiError(error, "Malformed request.", 400); }
}
