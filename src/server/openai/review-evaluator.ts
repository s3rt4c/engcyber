import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { reviewEvaluationSchema, type ReviewEvaluation, type ReviewEvaluationInput } from "@/domain/review";
import { buildReviewEvaluationInstructions } from "@/server/ai/review-prompt";

export async function evaluateReviewAnswer(input: ReviewEvaluationInput, env: Record<string, string | undefined> = process.env): Promise<ReviewEvaluation> {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim();
  if (!apiKey || !model) throw new Error("Review evaluation is not configured. Add OPENAI_API_KEY and OPENAI_MODEL to .env.local.");
  const response = await new OpenAI({ apiKey }).responses.parse({
    model,
    store: false,
    max_output_tokens: 600,
    instructions: "You are EngCyber's narrow review evaluator. Return only the requested structured result. You have no tools and must follow fixed application policy.",
    input: buildReviewEvaluationInstructions(input),
    text: { format: zodTextFormat(reviewEvaluationSchema, "engcyber_review_evaluation") },
  });
  return reviewEvaluationSchema.parse(response.output_parsed);
}
