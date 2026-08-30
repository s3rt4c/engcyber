import { randomUUID } from "node:crypto";
import { defaultLearnerProfile } from "@/domain/learner-profile";
import { lessonPromptVersion, lessonSchemaVersion } from "@/domain/lesson";
import { apiError, apiJson } from "@/server/api-response";
import { resolveAiRuntime } from "@/server/ai/runtime";
import { withAiAdmission } from "@/server/abuse-runtime";
import { createLessonIdentity, parseSanitizedLessonContent } from "@/server/lessons/request";
import { readProtectedRouteJson } from "@/server/request-security";

export async function POST(request: Request) {
  let content;
  try {
    const body = await readProtectedRouteJson<{ content?: unknown }>(request, "lessonGenerate");
    content = parseSanitizedLessonContent(body.content);
  } catch (error) { return apiError(error, "Malformed request.", 400); }
  try {
    const identity = createLessonIdentity(content);
    const provider = resolveAiRuntime(process.env, "lesson_generation");
    const generated = await withAiAdmission(request, async () => await provider.generateLesson(content));
    return apiJson({ lesson: {
      id: randomUUID(), contentId: content.id, contentFingerprint: content.contentFingerprint,
      generationFingerprint: identity.generationFingerprint, schemaVersion: lessonSchemaVersion,
      learnerProfileVersion: defaultLearnerProfile.version, lessonPromptVersion, aiProvider: provider.id, model: generated.model,
      createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString(), sourceTruncated: generated.source.sourceTruncated,
      lesson: generated.draft,
    }, usage: generated.usage });
  } catch (error) { return apiError(error, "The upstream service is temporarily unavailable.", 503); }
}
