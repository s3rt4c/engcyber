import "server-only";

import { z } from "zod";
import { parseSanitizedLessonContent } from "@/server/lessons/request";
import { storedInitialWritingFeedbackSchema, writingDraftMaximumCharacters, writingDraftProblem, type CompactErrorPatternSummary, type WritingAnalysisInput } from "@/domain/writing";

const requestSchema = z.object({
  content: z.unknown(), writingSessionId: z.string().trim().min(1).max(120), stage: z.enum(["initial", "revision"]),
  task: z.string().trim().min(20).max(800), draft: z.string().trim().min(1).max(writingDraftMaximumCharacters),
  originalDraft: z.string().trim().min(1).max(writingDraftMaximumCharacters).optional(), initialFeedback: z.unknown().optional(),
  errorMemory: z.array(z.object({ patternKey: z.string().trim().min(3).max(160), status: z.enum(["needs_practice", "improving", "mastered", "returned"]), occurrenceCount: z.number().int().min(1).max(200), recentSeverity: z.enum(["minor", "moderate", "major", "critical"]) }).strict()).max(8),
}).strict();

export function parseWritingAnalysisRequest(value: unknown): WritingAnalysisInput {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) throw new Error("A complete writing-analysis request is required.");
  const draftProblem = writingDraftProblem(parsed.data.draft);
  if (draftProblem) throw new Error(draftProblem);
  const content = parseSanitizedLessonContent(parsed.data.content);
  if (parsed.data.stage === "initial") {
    if (parsed.data.initialFeedback || parsed.data.originalDraft) throw new Error("Initial writing analysis must not include a prior attempt.");
    return { stage: "initial", writingSessionId: parsed.data.writingSessionId, content, task: parsed.data.task, draft: parsed.data.draft, errorMemory: parsed.data.errorMemory as CompactErrorPatternSummary[] };
  }
  const initialFeedback = storedInitialWritingFeedbackSchema.safeParse(parsed.data.initialFeedback);
  if (!initialFeedback.success || !parsed.data.originalDraft) throw new Error("Revision analysis requires validated initial feedback and the original draft.");
  return { stage: "revision", writingSessionId: parsed.data.writingSessionId, content, task: parsed.data.task, draft: parsed.data.draft, originalDraft: parsed.data.originalDraft, initialFeedback: initialFeedback.data, errorMemory: parsed.data.errorMemory as CompactErrorPatternSummary[] };
}
