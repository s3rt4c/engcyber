import "server-only";

import { createHash } from "node:crypto";
import type { LearnerProfile } from "@/domain/learner-profile";
import { lessonPromptVersion, lessonSchemaVersion, type LessonGenerationIdentity } from "@/domain/lesson";
import type { AiProviderId } from "@/server/ai/provider";

export interface GenerationIdentityInput {
  readonly contentFingerprint: string;
  readonly learnerProfile: LearnerProfile;
  readonly aiProvider: AiProviderId;
  readonly lessonModel: string;
}

export function createGenerationIdentity(input: GenerationIdentityInput): LessonGenerationIdentity {
  const canonical = JSON.stringify({
    contentFingerprint: input.contentFingerprint,
    learnerProfileVersion: input.learnerProfile.version,
    lessonPromptVersion,
    lessonSchemaVersion,
    aiProvider: input.aiProvider,
    lessonModel: input.lessonModel,
  });
  return {
    generationFingerprint: `sha256:${createHash("sha256").update(canonical).digest("hex")}`,
    schemaVersion: lessonSchemaVersion,
  };
}
