import { NextRequest, NextResponse } from "next/server";
import { resolveAiRuntime } from "@/server/ai/runtime";
import { parseReviewEvaluationRequest } from "@/server/ai/review-request";

export async function POST(request: NextRequest) {
  try {
    const input = parseReviewEvaluationRequest(await request.json());
    const provider = resolveAiRuntime(process.env, "review_evaluation");
    const evaluation = await provider.evaluateReview(input);
    return NextResponse.json({ evaluation, provider: { id: provider.id, model: provider.actionModel } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review evaluation failed.";
    const status = message.includes("require") || message.includes("Unsupported AI_PROVIDER") || message.includes("not configured") ? 503 : message.includes("request") || message.includes("matching") || message.includes("eligible") ? 422 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
