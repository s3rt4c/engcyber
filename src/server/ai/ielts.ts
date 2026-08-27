import "server-only";

import { createHash } from "node:crypto";
import { defaultLearnerProfile } from "@/domain/learner-profile";
import { ieltsReadingGenerationFingerprint, type IeltsReadingGenerationInput } from "@/domain/ielts";
import { resolveAiRuntime } from "@/server/ai/runtime";

export function createIeltsReadingIdentity(input: IeltsReadingGenerationInput, env: Record<string, string | undefined> = process.env) {
  const provider = resolveAiRuntime(env, "ielts_reading_generation");
  const material = ieltsReadingGenerationFingerprint({ sourceFingerprint: input.sourceFingerprint, provider: provider.id, model: provider.lessonModel, learnerProfileVersion: defaultLearnerProfile.version });
  return { generationFingerprint: `sha256:${createHash("sha256").update(material).digest("hex")}`, provider: provider.id, model: provider.lessonModel };
}
