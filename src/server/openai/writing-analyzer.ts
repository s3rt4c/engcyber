import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { randomUUID } from "node:crypto";
import { defaultLearnerProfile } from "@/domain/learner-profile";
import { buildLessonSource } from "@/domain/lesson";
import { validateInitialWritingFeedback, validateRevisionWritingFeedback, writingInitialFeedbackSchema, writingRevisionFeedbackSchema, type GeneratedWritingFeedback, type WritingAnalysisInput } from "@/domain/writing";
import { buildWritingInstructions } from "@/server/ai/writing-prompt";

export function writingModelConfiguration(env: Record<string, string | undefined> = process.env): { apiKey: string; model: string } | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_LESSON_MODEL?.trim();
  return apiKey && model ? { apiKey, model } : null;
}

export async function analyzeWritingDraft(input: WritingAnalysisInput, env: Record<string, string | undefined> = process.env): Promise<GeneratedWritingFeedback> {
  if (input.content.sanitizationStatus !== "sanitized") throw new Error("Writing analysis requires sanitized content.");
  const configuration = writingModelConfiguration(env);
  if (!configuration) throw new Error("Writing analysis is not configured. Add OPENAI_API_KEY and OPENAI_LESSON_MODEL to .env.local.");
  const source = buildLessonSource(input.content.title, input.content.sanitizedText);
  const response = await new OpenAI({ apiKey: configuration.apiKey }).responses.parse({
    model: configuration.model,
    store: false,
    max_output_tokens: 2_500,
    instructions: "You are EngCyber's structured writing-feedback assistant. Return only the requested structured feedback. You have no tools and must follow fixed application policy.",
    input: buildWritingInstructions(defaultLearnerProfile, input, source),
    text: { format: zodTextFormat(input.stage === "initial" ? writingInitialFeedbackSchema : writingRevisionFeedbackSchema, "engcyber_writing_feedback") },
  });
  const validated = input.stage === "initial"
    ? validateInitialWritingFeedback(response.output_parsed, { draft: input.draft, source: source.text, issueId: randomUUID })
    : validateRevisionWritingFeedback(response.output_parsed, { draft: input.draft, source: source.text, initialFeedback: input.initialFeedback!, issueId: randomUUID });
  if (!validated.success) throw new Error("The generated writing feedback did not pass validation and was not saved.");
  return { feedback: validated.data, model: configuration.model, sourceTruncated: source.sourceTruncated };
}
