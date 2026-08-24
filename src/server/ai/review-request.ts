import "server-only";

import { z } from "zod";
import { errorMemoryConfidenceMinimum, errorOccurrenceSchema } from "@/domain/writing";
import { reviewItemSchema, type ReviewEvaluationInput } from "@/domain/review";

const requestSchema = z.object({
  item: reviewItemSchema,
  occurrence: errorOccurrenceSchema,
  answer: z.string().trim().min(1).max(1_200),
}).strict();

export function parseReviewEvaluationRequest(value: unknown): ReviewEvaluationInput {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) throw new Error("A complete review-evaluation request is required.");
  const { item, occurrence, answer } = parsed.data;
  if (item.representativeOccurrenceId !== occurrence.id || item.patternKey !== occurrence.patternKey || item.category !== occurrence.category || item.subcategory !== occurrence.subcategory) {
    throw new Error("Review evaluation requires a matching historical occurrence.");
  }
  if (occurrence.dismissed || occurrence.confidence < errorMemoryConfidenceMinimum) throw new Error("Review evaluation requires an eligible historical occurrence.");
  return {
    patternKey: item.patternKey,
    category: item.category,
    subcategory: occurrence.subcategory,
    exerciseType: item.stage < 2 ? "correction" : "free_production",
    learnerAnswer: answer,
    ...(item.stage < 2 ? { originalText: occurrence.originalText, canonicalCorrection: occurrence.correctedText } : {}),
  };
}
