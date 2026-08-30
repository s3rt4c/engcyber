import { apiError, apiJson } from "@/server/api-response";
import { parseIeltsWritingRequest } from "@/server/ai/ielts-request";
import { resolveAiRuntime } from "@/server/ai/runtime";
import { withAiAdmission } from "@/server/abuse-runtime";
import { readProtectedRouteJson } from "@/server/request-security";

export async function POST(request: Request) {
  let input;
  try {
    input = parseIeltsWritingRequest(await readProtectedRouteJson(request, "ieltsWritingAnalyze"));
  } catch (error) { return apiError(error, "Malformed request.", 400); }
  try {
    const provider = resolveAiRuntime(process.env, "ielts_writing_feedback");
    const generated = await withAiAdmission(request, async () => await provider.analyzeIeltsWriting(input));
    return apiJson({ feedback: generated.feedback, model: generated.model });
  } catch (error) { return apiError(error, "The upstream service is temporarily unavailable.", 503); }
}
