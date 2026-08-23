import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { defaultLearnerProfile } from "@/domain/learner-profile";
import { lessonPromptVersion, lessonSchemaVersion } from "@/domain/lesson";
import { resolveAiRuntime } from "@/server/ai/runtime";
import { createLessonIdentity, parseSanitizedLessonContent } from "@/server/lessons/request";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { content?: unknown };
    const content = parseSanitizedLessonContent(body.content);
    const identity = createLessonIdentity(content);
    const provider = resolveAiRuntime(process.env, "lesson_generation");
    const generated = await provider.generateLesson(content);
    return NextResponse.json({ lesson: {
      id: randomUUID(), contentId: content.id, contentFingerprint: content.contentFingerprint,
      generationFingerprint: identity.generationFingerprint, schemaVersion: lessonSchemaVersion,
      learnerProfileVersion: defaultLearnerProfile.version, lessonPromptVersion, aiProvider: provider.id, model: generated.model,
      createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString(), sourceTruncated: generated.source.sourceTruncated,
      lesson: generated.draft,
    }, usage: generated.usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lesson generation failed.";
    const status = message.includes("require") || message.includes("Unsupported AI_PROVIDER") ? 503 : message.includes("too short") || message.includes("sanitized") || message.includes("fingerprint") ? 422 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
