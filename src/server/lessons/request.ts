import "server-only";

import { createHash } from "node:crypto";
import type { Content } from "@/domain/models";
import { contentCategories } from "@/domain/learning";
import { defaultLearnerProfile } from "@/domain/learner-profile";
import { resolveAiProvider } from "@/server/ai/provider";
import { createGenerationIdentity } from "@/server/lessons/identity";

const categories: ReadonlySet<string> = new Set(contentCategories.map((category) => category.id));
const contentTypes = new Set(["article", "manual", "write_up", "document", "transcript", "podcast"]);

export function contentFingerprintFor(sanitizedText: string): string {
  return `sha256:${createHash("sha256").update(sanitizedText).digest("hex")}`;
}

export function parseSanitizedLessonContent(value: unknown): Content {
  if (!value || typeof value !== "object") throw new Error("A sanitized article is required.");
  const content = value as Record<string, unknown>;
  if (content.sanitizationStatus !== "sanitized") throw new Error("Lesson generation requires sanitized content.");
  if (typeof content.id !== "string" || typeof content.title !== "string" || typeof content.sanitizedText !== "string" || typeof content.contentFingerprint !== "string") throw new Error("A complete sanitized article is required.");
  if (/<\/?[a-z][^>]*>/iu.test(content.sanitizedText)) throw new Error("Sanitized article text must not contain markup.");
  if (!categories.has(String(content.primaryCategory)) || !contentTypes.has(String(content.contentType))) throw new Error("The article category is invalid.");
  if (contentFingerprintFor(content.sanitizedText) !== content.contentFingerprint) throw new Error("The article fingerprint is invalid.");
  return {
    id: content.id,
    feedItemId: typeof content.feedItemId === "string" ? content.feedItemId : null,
    title: content.title,
    canonicalUrl: typeof content.canonicalUrl === "string" ? content.canonicalUrl : null,
    publishedAt: typeof content.publishedAt === "string" && !Number.isNaN(Date.parse(content.publishedAt)) ? new Date(content.publishedAt) : null,
    author: typeof content.author === "string" ? content.author : null,
    primaryCategory: content.primaryCategory as Content["primaryCategory"],
    tags: Array.isArray(content.tags) ? content.tags.filter((tag): tag is string => typeof tag === "string") : [],
    contentType: content.contentType as Content["contentType"],
    sanitizedText: content.sanitizedText,
    contentFingerprint: content.contentFingerprint,
    sanitizationStatus: "sanitized",
  };
}

export function createLessonIdentity(content: Content, env: Record<string, string | undefined> = process.env) {
  const provider = resolveAiProvider(env, "lesson_generation");
  return createGenerationIdentity({ contentFingerprint: content.contentFingerprint, learnerProfile: defaultLearnerProfile, aiProvider: provider.id, lessonModel: provider.lessonModel });
}
