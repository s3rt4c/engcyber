import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { Content } from "@/domain/models";
import type { LessonGenerator } from "@/domain/boundaries";
import { defaultLearnerProfile, type LearnerProfile } from "@/domain/learner-profile";
import { buildLessonSource, lessonDraftSchema, validateLessonDraft, type GeneratedLesson } from "@/domain/lesson";
import { buildLessonInstructions } from "@/server/ai/lesson-prompt";
import { openAiClientOptions } from "@/server/ai/provider-request";

export { buildLessonInstructions } from "@/server/ai/lesson-prompt";

export function lessonModelConfiguration(env: Record<string, string | undefined> = process.env): { apiKey: string; model: string } | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_LESSON_MODEL?.trim();
  return apiKey && model ? { apiKey, model } : null;
}

export function validateGeneratedLesson(value: unknown, suppliedLessonSource: string) {
  return validateLessonDraft(value, suppliedLessonSource);
}

export async function generateLessonDraft(content: Content, options: { learnerProfile?: LearnerProfile; env?: Record<string, string | undefined> } = {}): Promise<GeneratedLesson> {
  if (content.sanitizationStatus !== "sanitized") throw new Error("Lesson generation requires sanitized content.");
  const config = lessonModelConfiguration(options.env);
  if (!config) throw new Error("Lesson generation is not configured. Add OPENAI_API_KEY and OPENAI_LESSON_MODEL to .env.local.");
  const source = buildLessonSource(content.title, content.sanitizedText);
  if (source.text.replace(/^Title:.*\n*/u, "").trim().length < 240) throw new Error("This article is too short to create a useful lesson.");
  const response = await new OpenAI(openAiClientOptions(config.apiKey)).responses.parse({
    model: config.model,
    store: false,
    max_output_tokens: 3_000,
    instructions: "You are EngCyber's English-learning lesson generator. Return only the requested structured lesson. You have no tools and must follow the fixed application policy.",
    input: buildLessonInstructions(options.learnerProfile ?? defaultLearnerProfile, source),
    text: { format: zodTextFormat(lessonDraftSchema, "engcyber_lesson") },
  });
  const validated = validateGeneratedLesson(response.output_parsed, source.text);
  if (!validated.success) throw new Error("The generated lesson did not pass validation and was not saved.");
  return { draft: validated.data, source, model: config.model };
}

export const serverLessonGenerator: LessonGenerator = {
  generate: ({ content, learnerProfile }) => generateLessonDraft(content, { learnerProfile }),
};
