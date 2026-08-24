"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserErrorMemoryStore, type ErrorMemorySnapshot } from "@/client/local-error-memory-store";
import { checkReviewAnswer } from "@/client/review-flow";
import { createBrowserReviewStore, type ReviewSnapshot } from "@/client/local-review-store";
import { applyReviewVerdict, buildReviewExercise, queueReviewItems, synchronizeReviewItems, type ReviewItem } from "@/domain/review";

function createdId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function patternLabel(patternKey: string): string {
  return patternKey.split(".").map((part) => part.replaceAll("_", " ")).join(" · ");
}

function sameItems(left: readonly ReviewItem[], right: readonly ReviewItem[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function ReviewPractice() {
  const [memoryStore] = useState(createBrowserErrorMemoryStore);
  const [reviewStore] = useState(createBrowserReviewStore);
  const [memory, setMemory] = useState<ErrorMemorySnapshot>({ occurrences: [], patterns: [] });
  const [review, setReview] = useState<ReviewSnapshot>({ items: [], events: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [reviewSessionId] = useState(() => createdId("review-session"));

  const refresh = async () => {
    const [nextMemory, storedReview] = await Promise.all([memoryStore.snapshot(), reviewStore.snapshot()]);
    const now = new Date().toISOString();
    const items = synchronizeReviewItems(nextMemory.patterns, nextMemory.occurrences, storedReview.items, { now, createId: () => createdId("review") });
    if (!sameItems(items, storedReview.items)) await reviewStore.save(items, storedReview.events);
    setMemory(nextMemory);
    setReview({ items, events: storedReview.events });
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const [nextMemory, storedReview] = await Promise.all([memoryStore.snapshot(), reviewStore.snapshot()]);
      const refreshedAt = new Date().toISOString();
      const items = synchronizeReviewItems(nextMemory.patterns, nextMemory.occurrences, storedReview.items, { now: refreshedAt, createId: () => createdId("review") });
      if (!sameItems(items, storedReview.items)) await reviewStore.save(items, storedReview.events);
      if (active) {
        setMemory(nextMemory);
        setReview({ items, events: storedReview.events });
      }
    })();
    return () => { active = false; };
  }, [memoryStore, reviewStore]);

  const now = new Date().toISOString();
  const dueItems = useMemo(() => queueReviewItems(review.items, memory.patterns, now), [memory.patterns, now, review.items]);
  const activeItems = useMemo(() => review.items.filter((item) => item.status === "scheduled" && memory.patterns.some((pattern) => pattern.patternKey === item.patternKey)).sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.patternKey.localeCompare(right.patternKey)), [memory.patterns, review.items]);
  const upcomingCount = activeItems.filter((item) => item.dueAt > now).length;
  const masteredCount = review.items.filter((item) => item.status === "mastered").length;
  const returnedCount = memory.patterns.filter((pattern) => pattern.status === "returned").length;
  const current = useMemo(() => {
    const candidates = dueItems.length ? dueItems : activeItems;
    return candidates.find((item) => item.id === selectedId) ?? candidates[0] ?? null;
  }, [activeItems, dueItems, selectedId]);
  const occurrence = current ? memory.occurrences.find((entry) => entry.id === current.representativeOccurrenceId) ?? null : null;
  const exercise = current && occurrence ? buildReviewExercise(current, occurrence) : null;
  const due = Boolean(current && current.dueAt <= now);

  const submit = async () => {
    if (!current || !occurrence || !exercise) return;
    setBusy(true); setNotice(""); setFeedback("");
    const checked = await checkReviewAnswer(fetch, { item: current, occurrence, answer });
    if (!checked.ok) { setNotice(checked.error); setBusy(false); return; }
    const reviewedAt = new Date().toISOString();
    const reviewKind = current.dueAt <= reviewedAt ? "scheduled" : "practice_now";
    const applied = applyReviewVerdict(current, checked.evaluation.verdict, reviewKind, reviewedAt, createdId("review-event"), reviewSessionId, checked.provider ? { providerUsed: true, providerId: checked.provider.id, providerModel: checked.provider.model } : undefined);
    const nextItems = review.items.map((item) => item.id === current.id ? applied.item : item);
    const reviewSaved = await reviewStore.save(nextItems, [...review.events, applied.event]);
    const memorySaved = applied.masteredPatternKey
      ? await memoryStore.setReviewStatus(applied.masteredPatternKey, "mastered")
      : checked.evaluation.verdict === "incorrect"
        ? await memoryStore.setReviewStatus(current.patternKey, "needs_practice")
        : true;
    if (!reviewSaved || !memorySaved) setNotice("Your result could not be saved locally. Check browser storage and try again.");
    setFeedback(checked.evaluation.feedback);
    setAnswer("");
    await refresh();
    setBusy(false);
  };

  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-3xl"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-6"><div><p className="text-sm font-semibold tracking-[0.2em] text-cyan-300 uppercase">EngCyber</p><h1 className="mt-2 text-3xl font-semibold">Error Pattern Review</h1></div><Link className="rounded border border-cyan-300 px-4 py-2 text-sm text-cyan-200" href="/">Discover</Link></header>
    <p className="mt-6 max-w-2xl text-slate-300">This M4 queue schedules only Personal Error Memory patterns. Saved phrases and vocabulary review are intentionally deferred.</p>
    {memory.patterns.length === 0 && <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-lg font-semibold">No Personal Error Memory patterns yet</h2><p className="mt-2 text-sm text-slate-300">Analyze writing from a lesson to create high-confidence patterns, then return here for correction and transfer practice.</p></section>}
    {memory.patterns.length > 0 && <section className="mt-8"><div className="grid gap-3 sm:grid-cols-4"><article className="rounded border border-slate-700 p-3"><p className="text-sm text-slate-400">Due now</p><p className="mt-1 text-2xl font-semibold">{dueItems.length}</p></article><article className="rounded border border-slate-700 p-3"><p className="text-sm text-slate-400">Upcoming</p><p className="mt-1 text-2xl font-semibold">{upcomingCount}</p></article><article className="rounded border border-slate-700 p-3"><p className="text-sm text-slate-400">Mastered</p><p className="mt-1 text-2xl font-semibold">{masteredCount}</p></article><article className="rounded border border-slate-700 p-3"><p className="text-sm text-slate-400">Needs attention</p><p className="mt-1 text-2xl font-semibold">{returnedCount}</p></article></div><div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">{dueItems.length ? `${dueItems.length} review${dueItems.length === 1 ? "" : "s"} due` : "Practice your active patterns"}</h2><p className="mt-1 text-sm text-slate-400">Stage 0/1: correction. Stage 2/3: free production. Only successful due reviews advance spacing.</p><p className="mt-1 text-xs text-slate-500">Review events recorded: {review.events.length}</p></div><div className="flex gap-3"><button className="rounded border border-slate-600 px-3 py-2 text-sm" onClick={() => { setSelectedId(null); setNotice(""); setFeedback(""); }}>Refresh queue</button><button className="rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={!current} onClick={() => setStarted(true)}>{dueItems.length ? "Start Review" : "Practice Now"}</button></div></div>
      {!started ? <p className="mt-5 rounded border border-slate-800 p-4 text-sm text-slate-400">Start a small session of at most five due items, or use Practice Now without advancing an upcoming item.</p> : !current || !occurrence || !exercise ? <p className="mt-5 rounded border border-slate-800 p-4 text-sm text-slate-400">There are no active review items. A later writing recurrence will reactivate a returned pattern.</p> : <section className="mt-5 rounded-xl border border-cyan-400/40 bg-slate-900 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">{patternLabel(current.patternKey)} · stage {current.stage + 1} of 4</p><p className="mt-1 text-sm text-slate-400">{due ? "Scheduled review due now." : `Practice Now — next scheduled review: ${new Date(current.dueAt).toLocaleDateString()}. A correct answer will not advance the stage.`}</p><p className="mt-1 text-xs text-slate-500">History: {current.successfulReviews} successful · {current.failedReviews} incorrect · {current.lapseCount} lapse{current.lapseCount === 1 ? "" : "s"}</p></div>{activeItems.length > 1 && <select aria-label="Choose an active review pattern" className="rounded border border-slate-600 bg-slate-950 p-2 text-sm" value={current.id} onChange={(event) => { setSelectedId(event.target.value); setAnswer(""); setFeedback(""); }}>{activeItems.map((item) => <option key={item.id} value={item.id}>{patternLabel(item.patternKey)} · stage {item.stage + 1}</option>)}</select>}</div>
        <p className="mt-5 text-lg leading-8">{exercise.prompt}</p><label className="mt-5 block text-sm font-medium" htmlFor="review-answer">Your answer</label><textarea id="review-answer" className="mt-2 min-h-28 w-full rounded border border-slate-700 bg-slate-950 p-3 leading-7" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={exercise.type === "correction" ? "Write the corrected sentence." : "Write one concise sentence."} />
        <p className="mt-2 text-xs text-slate-400">Exact stored corrections are checked locally. Alternative corrections and free production are sent to the configured AI provider only when you select Check Answer.</p><button className="mt-4 rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={busy} onClick={submit}>{busy ? "Checking…" : "Check Answer"}</button>
        {feedback && <p className="mt-4 rounded bg-slate-950 p-3 text-sm text-slate-200">{feedback}</p>}{notice && <p className="mt-3 text-sm text-amber-200">{notice}</p>}
      </section>}
    </section>}
    {memory.patterns.length > 0 && <section className="mt-10 border-t border-slate-800 pt-6"><h2 className="text-lg font-semibold">Personal Error Memory</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{memory.patterns.slice(0, 8).map((pattern) => <article className="rounded border border-slate-700 p-3" key={pattern.patternKey}><p className="font-medium">{patternLabel(pattern.patternKey)}</p><p className="mt-1 text-sm text-slate-300">{pattern.occurrenceCount} occurrence{pattern.occurrenceCount === 1 ? "" : "s"} · {pattern.status.replaceAll("_", " ")}</p></article>)}</div></section>}
  </div></main>;
}
