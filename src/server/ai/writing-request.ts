import "server-only";

import { z } from "zod";
import { contentFingerprintFor, parseSanitizedLessonContent } from "@/server/lessons/request";
import { storedLessonContextSchema } from "@/domain/lesson";
import { storedInitialWritingFeedbackSchema, writingDraftMaximumCharacters, writingDraftProblem, type CompactErrorPatternSummary, type WritingAnalysisInput } from "@/domain/writing";

const requestSchema = z.object({
  content: z.unknown().optional(), lessonContext: z.unknown().optional(), writingSessionId: z.string().trim().min(1).max(120), stage: z.enum(["initial", "revision"]),
  task: z.string().trim().min(20).max(800), draft: z.string().trim().min(1).max(writingDraftMaximumCharacters),
  originalDraft: z.string().trim().min(1).max(writingDraftMaximumCharacters).optional(), initialFeedback: z.unknown().optional(),
  errorMemory: z.array(z.object({ patternKey: z.string().trim().min(3).max(160), status: z.enum(["needs_practice", "improving", "mastered", "returned"]), occurrenceCount: z.number().int().min(1).max(200), recentSeverity: z.enum(["minor", "moderate", "major", "critical"]) }).strict()).max(8),
}).strict();

export function parseWritingAnalysisRequest(value: unknown): WritingAnalysisInput {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) throw new Error("A complete writing-analysis request is required.");
  const draftProblem = writingDraftProblem(parsed.data.draft);
  if (draftProblem) throw new Error(draftProblem);
  if ((parsed.data.content === undefined) === (parsed.data.lessonContext === undefined)) throw new Error("Writing analysis requires either sanitized content or validated saved lesson context.");
  const context = parsed.data.lessonContext === undefined ? null : storedLessonContextSchema.safeParse(parsed.data.lessonContext);
  if (context && !context.success) throw new Error("Writing analysis requires validated saved lesson context.");
  const content = context?.success ? {
    id: context.data.contentId, feedItemId: null, title: context.data.title, canonicalUrl: context.data.canonicalUrl, publishedAt: null, author: null,
    primaryCategory: context.data.primaryCategory, tags: [], contentType: context.data.contentType, sanitizedText: context.data.sourceText,
    contentFingerprint: contentFingerprintFor(context.data.sourceText), sanitizationStatus: "sanitized" as const,
  } : parseSanitizedLessonContent(parsed.data.content);
  const source = context?.success ? { text: context.data.sourceText, sourceTruncated: context.data.sourceTruncated } : undefined;
  if (parsed.data.stage === "initial") {
    if (parsed.data.initialFeedback || parsed.data.originalDraft) throw new Error("Initial writing analysis must not include a prior attempt.");
    return { stage: "initial", writingSessionId: parsed.data.writingSessionId, content, ...(source ? { source } : {}), task: parsed.data.task, draft: parsed.data.draft, errorMemory: parsed.data.errorMemory as CompactErrorPatternSummary[] };
  }
  const initialFeedback = storedInitialWritingFeedbackSchema.safeParse(parsed.data.initialFeedback);
  if (!initialFeedback.success || !parsed.data.originalDraft) throw new Error("Revision analysis requires validated initial feedback and the original draft.");
  return { stage: "revision", writingSessionId: parsed.data.writingSessionId, content, ...(source ? { source } : {}), task: parsed.data.task, draft: parsed.data.draft, originalDraft: parsed.data.originalDraft, initialFeedback: initialFeedback.data, errorMemory: parsed.data.errorMemory as CompactErrorPatternSummary[] };
}
