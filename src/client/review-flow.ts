import { gradeLocalCorrection, reviewEvaluationSchema, type ReviewEvaluation, type ReviewItem } from "@/domain/review";
import type { ErrorOccurrence } from "@/domain/writing";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type ProviderMetadata = { readonly id: "gemini" | "openai"; readonly model: string };

export type ReviewAnswerResult =
  | { readonly ok: true; readonly evaluation: ReviewEvaluation; readonly provider: ProviderMetadata | null }
  | { readonly ok: false; readonly error: string };

function providerMetadata(value: unknown): ProviderMetadata | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { id?: unknown; model?: unknown };
  return (candidate.id === "gemini" || candidate.id === "openai") && typeof candidate.model === "string" && candidate.model.trim() ? { id: candidate.id, model: candidate.model } : null;
}

export async function checkReviewAnswer(fetcher: Fetcher, input: { readonly item: ReviewItem; readonly occurrence: ErrorOccurrence; readonly answer: string }): Promise<ReviewAnswerResult> {
  const answer = input.answer.trim();
  if (!answer) return { ok: false, error: "Write an answer before checking it." };
  if (input.item.stage < 2 && gradeLocalCorrection(answer, input.occurrence.correctedText).verdict === "correct") {
    return { ok: true, evaluation: { verdict: "correct", feedback: "Correct. Your correction matches the stored target pattern.", demonstratesTargetPattern: true, optionalCorrection: null }, provider: null };
  }
  try {
    const response = await fetcher("/api/review/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: input.item, occurrence: input.occurrence, answer }) });
    const data: unknown = await response.json();
    if (!response.ok) return { ok: false, error: typeof data === "object" && data !== null && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "Review evaluation is temporarily unavailable." };
    if (!data || typeof data !== "object") return { ok: false, error: "Review evaluation could not be validated." };
    const evaluation = reviewEvaluationSchema.safeParse((data as { evaluation?: unknown }).evaluation);
    const provider = providerMetadata((data as { provider?: unknown }).provider);
    if (!evaluation.success || !provider) return { ok: false, error: "Review evaluation could not be validated." };
    return { ok: true, evaluation: evaluation.data, provider };
  } catch { return { ok: false, error: "Review evaluation is temporarily unavailable." }; }
}
