import "server-only";

import type { Content } from "@/domain/models";
import type { ExplicitActionInput } from "@/domain/sentence-actions";
import type { LearnerProfile } from "@/domain/learner-profile";
import type { GeneratedLesson } from "@/domain/lesson";
import type { GeneratedWritingFeedback, WritingAnalysisInput } from "@/domain/writing";
import type { ReviewEvaluation, ReviewEvaluationInput } from "@/domain/review";
import type { ResolvedAiProvider } from "@/server/ai/provider";
import { retryTransientAiOperation } from "@/server/ai/retry";
import { generateLessonDraft } from "@/server/openai/lesson-generator";
import { runSentenceAction } from "@/server/openai/sentence-actions";
import { analyzeWritingDraft } from "@/server/openai/writing-analyzer";
import { evaluateReviewAnswer } from "@/server/openai/review-evaluator";

export interface OpenAiProvider {
  readonly id: "openai";
  readonly actionModel: string;
  readonly lessonModel: string;
  runSentenceAction(input: ExplicitActionInput): Promise<string>;
  generateLesson(content: Content, learnerProfile?: LearnerProfile): Promise<GeneratedLesson>;
  analyzeWriting(input: WritingAnalysisInput): Promise<GeneratedWritingFeedback>;
  evaluateReview(input: ReviewEvaluationInput): Promise<ReviewEvaluation>;
}

export function createOpenAiProvider(configuration: ResolvedAiProvider): OpenAiProvider {
  if (configuration.id !== "openai") throw new Error("OpenAI provider configuration is required.");
  const env = {
    OPENAI_API_KEY: configuration.apiKey,
    OPENAI_MODEL: configuration.actionModel,
    OPENAI_LESSON_MODEL: configuration.lessonModel,
  };
  return {
    id: "openai",
    actionModel: configuration.actionModel,
    lessonModel: configuration.lessonModel,
    runSentenceAction: async (input) => (await retryTransientAiOperation(() => runSentenceAction(input, env))).value,
    generateLesson: async (content, learnerProfile) => (await retryTransientAiOperation(() => generateLessonDraft(content, { learnerProfile, env }))).value,
    analyzeWriting: async (input) => (await retryTransientAiOperation(() => analyzeWritingDraft(input, env))).value,
    evaluateReview: async (input) => (await retryTransientAiOperation(() => evaluateReviewAnswer(input, env))).value,
  };
}
