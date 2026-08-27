import "server-only";

import type { Content } from "@/domain/models";
import type { ExplicitActionInput } from "@/domain/sentence-actions";
import type { LearnerProfile } from "@/domain/learner-profile";
import type { GeneratedLesson } from "@/domain/lesson";
import type { GeneratedWritingFeedback, WritingAnalysisInput } from "@/domain/writing";
import type { ReviewEvaluation, ReviewEvaluationInput } from "@/domain/review";
import type { GeneratedIeltsReadingPractice, GeneratedIeltsWritingFeedback, IeltsReadingGenerationInput, IeltsWritingAnalysisInput } from "@/domain/ielts";
import { createGeminiProvider } from "@/server/ai/gemini";
import { createOpenAiProvider } from "@/server/ai/openai";
import { resolveAiProvider, type AiCapability, type AiProviderId, type ResolvedAiProvider } from "@/server/ai/provider";

export interface AiRuntimeProvider {
  readonly id: AiProviderId;
  readonly actionModel: string;
  readonly lessonModel: string;
  runSentenceAction(input: ExplicitActionInput): Promise<string>;
  generateLesson(content: Content, learnerProfile?: LearnerProfile): Promise<GeneratedLesson>;
  analyzeWriting(input: WritingAnalysisInput): Promise<GeneratedWritingFeedback>;
  evaluateReview(input: ReviewEvaluationInput): Promise<ReviewEvaluation>;
  generateIeltsReading(input: IeltsReadingGenerationInput): Promise<GeneratedIeltsReadingPractice>;
  analyzeIeltsWriting(input: IeltsWritingAnalysisInput): Promise<GeneratedIeltsWritingFeedback>;
}

export interface AiProviderFactories {
  readonly gemini: (configuration: ResolvedAiProvider) => AiRuntimeProvider;
  readonly openai: (configuration: ResolvedAiProvider) => AiRuntimeProvider;
}

const defaultFactories: AiProviderFactories = { gemini: createGeminiProvider, openai: createOpenAiProvider };

export function resolveAiRuntime(env: Record<string, string | undefined> = process.env, capability: AiCapability, factories: AiProviderFactories = defaultFactories): AiRuntimeProvider {
  const configuration = resolveAiProvider(env, capability);
  return factories[configuration.id](configuration);
}
