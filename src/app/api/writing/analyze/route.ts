import { apiError, apiJson } from "@/server/api-response";
import { resolveAiRuntime } from "@/server/ai/runtime";
import { withAiAdmission } from "@/server/abuse-runtime";
import { parseWritingAnalysisRequest } from "@/server/ai/writing-request";
import { WritingAnalysisFailure } from "@/server/ai/writing-diagnostics";
import { readProtectedRouteJson } from "@/server/request-security";

export async function POST(request: Request) {
  let input;
  try {
    input = parseWritingAnalysisRequest(await readProtectedRouteJson(request, "writingAnalyze"));
  } catch (error) { return apiError(error, "Malformed request.", 400); }
  try {
    const provider = resolveAiRuntime(process.env, "writing_analysis");
    const generated = await withAiAdmission(request, async () => await provider.analyzeWriting(input));
    return apiJson(generated);
  } catch (error) {
    if (error instanceof WritingAnalysisFailure) {
      return apiJson({ error: "Writing feedback could not be safely produced." }, { status: 422 });
    }
    return apiError(error, "The upstream service is temporarily unavailable.", 503);
  }
}
