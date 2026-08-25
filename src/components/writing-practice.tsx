"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserErrorMemoryStore, type ErrorMemorySnapshot } from "@/client/local-error-memory-store";
import { createBrowserWritingSessionStore } from "@/client/local-writing-session-store";
import { preserveRevisionTimestampOnDismissal, recordRevisionReview, submitWritingAnalysis, wordCountForWriting, writingTargetNotice } from "@/client/writing-flow";
import type { StoredLesson } from "@/domain/lesson";
import type { Content } from "@/domain/models";
import { compactErrorMemory, storedInitialWritingFeedbackSchema, storedRevisionWritingFeedbackSchema, type ErrorOccurrence, type WritingFeedbackIssue, type WritingSession } from "@/domain/writing";

function createdId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `writing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function issueOccurrence(issue: WritingFeedbackIssue, writingSessionId: string, attemptNumber: 1 | 2, createdAt: string): ErrorOccurrence {
  return { id: issue.id, writingSessionId, attemptNumber, category: issue.category, subcategory: issue.subcategory, patternKey: issue.patternKey, originalText: issue.originalText, correctedText: issue.correctedText, explanation: issue.explanation, severity: issue.severity, confidence: issue.confidence, sourceEvidence: issue.sourceEvidence, createdAt, dismissed: false, correctedAt: null };
}

function patternLabel(patternKey: string): string {
  return patternKey.split(".").map((part) => part.replaceAll("_", " ")).join(" · ");
}

function FeedbackIssueCard({ issue, dismissed, onDismiss }: { issue: WritingFeedbackIssue; dismissed: boolean; onDismiss: (id: string) => void }) {
  if (dismissed) return null;
  return <article className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">{patternLabel(issue.patternKey)} · {issue.severity}</p>
    <p className="mt-2 text-sm"><strong>Original:</strong> “{issue.originalText}”</p>
    <p className="mt-2 text-sm text-emerald-200"><strong>Better:</strong> “{issue.correctedText}”</p>
    <p className="mt-2 text-sm text-slate-300"><strong>Why:</strong> {issue.explanation}</p>
    {issue.confidence < 0.85 && <p className="mt-2 text-xs text-amber-200">Lower-confidence suggestion; it is not added to Personal Error Memory.</p>}
    <button className="mt-3 rounded border border-slate-600 px-3 py-1 text-sm" onClick={() => onDismiss(issue.id)}>Not an error</button>
  </article>;
}

export function WritingPractice({ storedLesson, content }: { storedLesson: StoredLesson; content: Content }) {
  const writing = storedLesson.lesson.writing;
  const [sessionStore] = useState(createBrowserWritingSessionStore);
  const [memoryStore] = useState(createBrowserErrorMemoryStore);
  const [session, setSession] = useState<WritingSession | null>(null);
  const [draft, setDraft] = useState("");
  const [memory, setMemory] = useState<ErrorMemorySnapshot>({ occurrences: [], patterns: [] });
  const [notice, setNotice] = useState("");
  const [diagnostic, setDiagnostic] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const dismissed = useMemo(() => new Set(session?.dismissedErrorIds ?? []), [session]);
  const refreshMemory = async () => setMemory(await memoryStore.snapshot());

  useEffect(() => {
    void (async () => {
      const [savedSession, snapshot] = await Promise.all([sessionStore.getByLesson(storedLesson.id), memoryStore.snapshot()]);
      if (savedSession) { setSession(savedSession); setDraft(savedSession.revisedDraft ?? savedSession.firstDraft); }
      setMemory(snapshot);
    })();
  }, [memoryStore, sessionStore, storedLesson.id]);

  const persistSession = async (next: WritingSession) => {
    setSession(next);
    await sessionStore.save(next);
  };

  const analyzeInitial = async () => {
    setBusy(true); setNotice(""); setDiagnostic(null);
    const writingSessionId = session?.id ?? createdId();
    const result = await submitWritingAnalysis(fetch, { draft, payload: { stage: "initial", writingSessionId, content, task: writing.task, errorMemory: compactErrorMemory(memory.patterns) } });
    if (!result.ok) { setNotice(result.error); setDiagnostic(result.diagnostic ?? null); setBusy(false); return; }
    const payload = result.data as { feedback?: unknown };
    const feedback = storedInitialWritingFeedbackSchema.safeParse(payload.feedback);
    if (!feedback.success) { setNotice("Writing feedback could not be validated."); setBusy(false); return; }
    const now = new Date().toISOString();
    const next: WritingSession = { id: writingSessionId, lessonId: storedLesson.id, contentId: content.id, contentFingerprint: content.contentFingerprint, task: writing.task, minWords: writing.minWords, maxWords: writing.maxWords, firstDraft: draft, initialFeedback: feedback.data, revisedDraft: null, revisionFeedback: null, dismissedErrorIds: session?.dismissedErrorIds ?? [], createdAt: session?.createdAt ?? now, updatedAt: now };
    await persistSession(next);
    await Promise.all(feedback.data.priorityErrors.filter((issue) => issue.memoryEligible).map((issue) => memoryStore.record(issueOccurrence(issue, writingSessionId, 1, now))));
    await refreshMemory();
    setNotice("Feedback is ready. Correct the draft yourself, then review your revision.");
    setBusy(false);
  };

  const analyzeRevision = async () => {
    if (!session?.initialFeedback) return;
    setBusy(true); setNotice("");
    const result = await submitWritingAnalysis(fetch, { draft, payload: { stage: "revision", writingSessionId: session.id, content, task: writing.task, originalDraft: session.firstDraft, initialFeedback: session.initialFeedback, errorMemory: compactErrorMemory(memory.patterns) } });
    if (!result.ok) { setNotice(result.error); setBusy(false); return; }
    const payload = result.data as { feedback?: unknown };
    const feedback = storedRevisionWritingFeedbackSchema.safeParse(payload.feedback);
    if (!feedback.success) { setNotice("Revision feedback could not be validated."); setBusy(false); return; }
    const now = new Date().toISOString();
    const next = recordRevisionReview(session, draft, feedback.data, now);
    await persistSession(next);
    await memoryStore.markCorrected(feedback.data.resolvedErrorIds, now);
    await Promise.all(feedback.data.newErrors.filter((issue) => issue.memoryEligible).map((issue) => memoryStore.record(issueOccurrence(issue, session.id, 2, now))));
    await refreshMemory();
    setNotice("Revision comparison is ready.");
    setBusy(false);
  };

  const dismissIssue = async (id: string) => {
    await memoryStore.dismiss(id);
    if (session) await persistSession(preserveRevisionTimestampOnDismissal(session, id, new Date().toISOString()));
    await refreshMemory();
    setNotice("Marked as not an error. It no longer contributes to Personal Error Memory.");
  };

  const targetNotice = writingTargetNotice(draft, writing.minWords, writing.maxWords);
  const feedback = session?.initialFeedback;
  const revision = session?.revisionFeedback;
  return <section className="mt-4 rounded-xl border border-slate-800 p-4" aria-label="Writing practice">
    <p>{writing.task}</p>
    <p className="mt-2 text-sm text-slate-400">Target: {writing.minWords}–{writing.maxWords} words. Current: {wordCountForWriting(draft)} words.</p>
    {targetNotice && <p className="mt-2 text-sm text-amber-200">{targetNotice}</p>}
    <label className="mt-4 block text-sm font-medium" htmlFor={`writing-${storedLesson.id}`}>Your draft</label>
    <textarea id={`writing-${storedLesson.id}`} className="mt-2 min-h-48 w-full rounded border border-slate-700 bg-slate-950 p-3 text-base leading-7" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write your response here before requesting feedback." />
    <p className="mt-3 text-xs text-slate-400">Your draft is sent to the configured AI provider only when you request feedback.</p>
    <div className="mt-3 flex flex-wrap gap-3">
      {!feedback && <button className="rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={busy} onClick={analyzeInitial}>{busy ? "Analyzing…" : "Analyze Writing"}</button>}
      {feedback && !revision && <button className="rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={busy} onClick={analyzeRevision}>{busy ? "Reviewing…" : "Review My Revision"}</button>}
    </div>
    {notice && <p className="mt-3 text-sm text-amber-200">{notice}</p>}{process.env.NODE_ENV !== "production" && diagnostic !== null && <pre className="mt-2 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-400">{JSON.stringify(diagnostic)}</pre>}
    {feedback && <section className="mt-6"><h3 className="text-lg font-semibold">Initial feedback</h3><p className="mt-2 text-slate-200">{feedback.overallFeedback}</p><div className="mt-4 space-y-3">{feedback.priorityErrors.map((issue) => <FeedbackIssueCard key={issue.id} issue={issue} dismissed={dismissed.has(issue.id)} onDismiss={dismissIssue} />)}</div>{feedback.vocabularySuggestions.length > 0 && <div className="mt-4"><h4 className="font-medium">Useful vocabulary</h4>{feedback.vocabularySuggestions.map((suggestion) => <p className="mt-2 text-sm" key={suggestion.originalText}><strong>{suggestion.originalText}</strong> → {suggestion.suggestion}: {suggestion.explanation}</p>)}</div>}{feedback.technicalAccuracy && <p className="mt-4 text-sm text-slate-300"><strong>Technical accuracy:</strong> {feedback.technicalAccuracy.note}</p>}<p className="mt-4 text-sm text-cyan-200">Try the writing again: {feedback.revisionFocus.join(" ")}</p></section>}
    {revision && <section className="mt-6"><h3 className="text-lg font-semibold">Revision feedback</h3><div className="mt-3 space-y-2 text-sm">{revision.improvements.map((improvement) => <p key={improvement}><strong>Improved:</strong> {improvement}</p>)}{revision.resolvedErrorIds.length > 0 && <p><strong>Resolved:</strong> {revision.resolvedErrorIds.length} important issue{revision.resolvedErrorIds.length === 1 ? "" : "s"}.</p>}{revision.remainingErrors.map((issue) => <p key={issue.initialErrorId}><strong>Still work on:</strong> {issue.explanation} {issue.recommendedAction}</p>)}{revision.newErrors.map((issue) => <FeedbackIssueCard key={issue.id} issue={issue} dismissed={dismissed.has(issue.id)} onDismiss={dismissIssue} />)}</div>{revision.improvedExample && <article className="mt-4 rounded-lg border border-emerald-700/50 bg-emerald-950/20 p-4"><h4 className="font-medium text-emerald-200">Improved comparison example</h4><p className="mt-2 text-sm leading-6">{revision.improvedExample}</p></article>}</section>}
    <section className="mt-8 border-t border-slate-800 pt-6"><h3 className="text-lg font-semibold">Personal Error Memory</h3>{memory.patterns.length === 0 ? <p className="mt-2 text-sm text-slate-400">High-confidence recurring patterns will appear here after explicit writing feedback.</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2">{memory.patterns.slice(0, 8).map((pattern) => <article className="rounded border border-slate-700 p-3" key={pattern.patternKey}><p className="font-medium">{patternLabel(pattern.patternKey)}</p><p className="mt-1 text-sm text-slate-300">{pattern.occurrenceCount} occurrence{pattern.occurrenceCount === 1 ? "" : "s"} · {pattern.status.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-400">Last seen: {new Date(pattern.lastSeenAt).toLocaleDateString()}</p></article>)}</div>}</section>
  </section>;
}
