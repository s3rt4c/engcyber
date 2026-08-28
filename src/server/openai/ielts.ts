import "server-only";

import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ieltsReadingDraftSchema, providerInitialIeltsWritingFeedbackSchema, providerRevisionIeltsWritingFeedbackSchema, validateIeltsInitialWritingFeedback, validateIeltsReadingDraft, validateIeltsRevisionWritingFeedback, wordCountForIelts, type GeneratedIeltsReadingPractice, type GeneratedIeltsWritingFeedback, type IeltsReadingGenerationInput, type IeltsWritingAnalysisInput } from "@/domain/ielts";
import { buildIeltsReadingInstructions, buildIeltsWritingInstructions } from "@/server/ai/ielts-prompt";
import { openAiClientOptions } from "@/server/ai/provider-request";

function configuration(env: Record<string, string | undefined>) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_LESSON_MODEL?.trim();
  if (!apiKey || !model) throw new Error("IELTS generation is not configured.");
  return { apiKey, model };
}

export async function generateOpenAiIeltsReading(input: IeltsReadingGenerationInput, env: Record<string, string | undefined>): Promise<GeneratedIeltsReadingPractice> {
  const config = configuration(env);
  const response = await new OpenAI(openAiClientOptions(config.apiKey)).responses.parse({ model: config.model, store: false, max_output_tokens: 2_800, instructions: "You are EngCyber's IELTS-style Reading generator. You have no tools, browsing, URL context, or external information.", input: buildIeltsReadingInstructions(input), text: { format: zodTextFormat(ieltsReadingDraftSchema, "engcyber_ielts_reading") } });
  const validated = validateIeltsReadingDraft(response.output_parsed, input.sourceText);
  if (!validated.success) throw new Error("The generated IELTS Reading practice did not pass validation and was not saved.");
  return { questions: validated.data.questions, model: config.model };
}

export async function analyzeOpenAiIeltsWriting(input: IeltsWritingAnalysisInput, env: Record<string, string | undefined>): Promise<GeneratedIeltsWritingFeedback> {
  const config = configuration(env);
  const response = await new OpenAI(openAiClientOptions(config.apiKey)).responses.parse({ model: config.model, store: false, max_output_tokens: 2_800, instructions: "You are EngCyber's IELTS-style writing-feedback assistant. You have no tools, browsing, source grounding, or official assessment role.", input: buildIeltsWritingInstructions(input), text: { format: zodTextFormat(input.stage === "initial" ? providerInitialIeltsWritingFeedbackSchema : providerRevisionIeltsWritingFeedbackSchema, "engcyber_ielts_writing") } });
  const validated = input.stage === "initial" ? validateIeltsInitialWritingFeedback(response.output_parsed, { draft: input.draft, issueId: randomUUID, wordCount: wordCountForIelts(input.draft) }) : validateIeltsRevisionWritingFeedback(response.output_parsed, { draft: input.draft, initialFeedback: input.initialFeedback!, issueId: randomUUID, wordCount: wordCountForIelts(input.draft) });
  if (!validated.success) throw new Error("The generated IELTS Writing feedback did not pass validation and was not saved.");
  return { feedback: validated.data, model: config.model };
}
