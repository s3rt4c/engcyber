import { apiError, apiJson } from "@/server/api-response";
import { resolveAiRuntime } from "@/server/ai/runtime";
import { withAiAdmission } from "@/server/abuse-runtime";
import { parseReviewEvaluationRequest } from "@/server/ai/review-request";
import { readProtectedRouteJson } from "@/server/request-security";

export async function POST(request: Request) {
  let input;
  try {
    input = parseReviewEvaluationRequest(await readProtectedRouteJson(request, "reviewEvaluation"));
  } catch (error) { return apiError(error, "Malformed request.", 400); }
  try {
    const provider = resolveAiRuntime(process.env, "review_evaluation");
    const evaluation = await withAiAdmission(request, async () => await provider.evaluateReview(input));
    return apiJson({ evaluation, provider: { id: provider.id, model: provider.actionModel } });
  } catch (error) { return apiError(error, "The upstream service is temporarily unavailable.", 503); }
}
