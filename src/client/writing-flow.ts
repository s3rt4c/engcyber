import { wordCountForWriting as domainWordCount, writingDraftProblem } from "@/domain/writing";
import type { RevisionWritingFeedback, WritingSession } from "@/domain/writing";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const wordCountForWriting = domainWordCount;

export function recordRevisionReview(session: WritingSession, revisedDraft: string, revisionFeedback: RevisionWritingFeedback, reviewedAt: string): WritingSession {
  return { ...session, revisedDraft, revisionFeedback, revisionReviewedAt: reviewedAt, updatedAt: reviewedAt };
}

export function preserveRevisionTimestampOnDismissal(session: WritingSession, issueId: string, updatedAt: string): WritingSession {
  return { ...session, dismissedErrorIds: [...new Set([...(session.dismissedErrorIds ?? []), issueId])], updatedAt };
}

export function writingTargetNotice(draft: string, minimum: number, maximum: number): string | null {
  const words = wordCountForWriting(draft);
  if (!words) return null;
  if (words < minimum) return `This is below the ${minimum}–${maximum}-word learning target, but you can still request feedback once it is evaluable.`;
  if (words > maximum) return `This is above the ${minimum}–${maximum}-word learning target, but you can still request feedback.`;
  return null;
}

export async function submitWritingAnalysis(fetcher: Fetcher, input: { readonly draft: string; readonly payload: Record<string, unknown> }): Promise<{ ok: true; data: unknown } | { ok: false; error: string; diagnostic?: unknown }> {
  const problem = writingDraftProblem(input.draft);
  if (problem) return { ok: false, error: problem };
  try {
    const response = await fetcher("/api/writing/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input.payload, draft: input.draft }) });
    const data: unknown = await response.json();
    if (!response.ok) return { ok: false, error: typeof data === "object" && data !== null && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "Writing feedback is temporarily unavailable.", diagnostic: typeof data === "object" && data !== null ? (data as { diagnostic?: unknown }).diagnostic : undefined };
    return { ok: true, data };
  } catch { return { ok: false, error: "Writing feedback is temporarily unavailable." }; }
}
