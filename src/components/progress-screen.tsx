"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { createBrowserErrorMemoryStore } from "@/client/local-error-memory-store";
import { createBrowserLessonStore } from "@/client/local-lesson-store";
import { createBrowserListeningStore } from "@/client/local-listening-store";
import { createBrowserReviewStore } from "@/client/local-review-store";
import { createBrowserVocabularyReviewStore } from "@/client/local-vocabulary-review-store";
import { createBrowserPhraseStore } from "@/client/local-phrase-store";
import { createBrowserWritingSessionStore } from "@/client/local-writing-session-store";
import { loadProgressSourceData } from "@/client/progress-loader";
import { buildProgressSnapshot, type ProgressRange, type ProgressSnapshot } from "@/domain/progress";
import { focusHref } from "@/client/local-learning-loaders";

const ranges: Array<{ readonly id: ProgressRange; readonly label: string }> = [{ id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }, { id: "all", label: "All time" }];

function percentage(value: number | null): string {
  return value === null ? "Not enough evidence" : `${Math.round(value * 100)}%`;
}

function trendLabel(snapshot: ProgressSnapshot): string {
  const trend = snapshot.listening.trend;
  if (trend.kind === "unavailable") return "Not enough dictation attempts to compare periods.";
  if (trend.kind === "similar") return "Similar to the previous period.";
  return `${trend.points} points ${trend.kind} than the previous period.`;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p></div>;
}

function Timeline({ snapshot }: { snapshot: ProgressSnapshot }) {
  return <section className="mt-8" aria-label="Activity timeline"><h2 className="text-xl font-semibold">Activity</h2><p className="mt-1 text-sm text-slate-400">{snapshot.timelineLabel}</p><ol className="mt-4 grid grid-cols-7 gap-2 sm:grid-cols-10" aria-label={snapshot.timelineLabel}>{snapshot.timeline.map((day) => {
    const total = day.lessons + day.writing + day.review + day.listening;
    return <li className="rounded border border-slate-800 bg-slate-900 p-2 text-center" key={day.date}><div className={`mx-auto h-10 w-3 rounded ${total ? "bg-cyan-300" : "bg-slate-800"}`} style={{ opacity: total ? Math.min(1, 0.35 + total / 6) : 1 }} /><p className="mt-2 text-xs text-slate-400">{day.date.slice(5)}</p><p className="text-xs text-slate-300">{total}</p></li>;
  })}</ol><p className="mt-3 text-xs text-slate-500">Lessons, writing submissions, reviews, and listening submissions are counted. Page opens and audio playback are not.</p></section>;
}

function ProgressContent({ snapshot }: { snapshot: ProgressSnapshot }) {
  const { activity, writing, errorMemory, review, vocabulary, listening, balance } = snapshot;
  return <>
    <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Overview">
      <Metric label="Active days" value={activity.activeDays} /><Metric label="Lessons created" value={activity.lessonsCreated} /><Metric label="Writing analyses" value={activity.writingAnalyses} />
      <Metric label="Revision reviews" value={activity.revisionReviews} /><Metric label="Review attempts" value={activity.reviewAttempts} /><Metric label="Dictations completed" value={activity.dictationsCompleted} />
    </section>
    {snapshot.focus.length > 0 && <section className="mt-8" aria-label="Focus"><h2 className="text-xl font-semibold">Focus</h2><ul className="mt-3 space-y-2">{snapshot.focus.map((entry) => <li key={entry.kind}><Link className="block rounded border border-cyan-400/30 bg-slate-900 p-4 text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href={focusHref(entry.action)}>{entry.message}</Link></li>)}</ul></section>}
    <section className="mt-8 grid gap-5 lg:grid-cols-2">
      <article className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-semibold">Current Error Memory</h2><p className="mt-1 text-sm text-slate-400">Current state, not range history.</p><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Needs practice" value={errorMemory.current.needs_practice} /><Metric label="Improving" value={errorMemory.current.improving} /><Metric label="Mastered" value={errorMemory.current.mastered} /><Metric label="Returned" value={errorMemory.current.returned} /></div><h3 className="mt-5 font-semibold">Top recurring patterns</h3>{errorMemory.topPatterns.length ? <ol className="mt-3 space-y-2">{errorMemory.topPatterns.map((pattern) => <li className="rounded border border-slate-700 p-3 text-sm" key={pattern.patternKey}><strong>{pattern.label}</strong><span className="text-slate-400"> · {pattern.occurrenceCount} occurrence{pattern.occurrenceCount === 1 ? "" : "s"} · {pattern.status.replaceAll("_", " ")}</span></li>)}</ol> : <p className="mt-3 text-sm text-slate-400">Analyze writing from a lesson to create high-confidence patterns.</p>}</article>
      <article className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-semibold">Current review state</h2><p className="mt-1 text-sm text-slate-400">Current due state, not range history.</p><div className="mt-4 grid grid-cols-3 gap-3"><Metric label="Due now" value={review.current.dueNow} /><Metric label="Overdue" value={review.current.overdue} /><Metric label="Mastered items" value={review.current.masteredItems} /></div><h3 className="mt-5 font-semibold">Reviews in this range</h3><div className="mt-3 grid grid-cols-2 gap-3"><Metric label="Scheduled" value={review.events.scheduled} /><Metric label="Practice Now" value={review.events.practiceNow} /><Metric label="Correct / incorrect" value={`${review.events.correct} / ${review.events.incorrect}`} /><Metric label="Success rate" value={percentage(review.events.successRate)} /></div><p className="mt-3 text-sm text-slate-400">Uncertain: {review.events.uncertain} · Incorrect events in this range: {review.events.incorrect}</p></article>
      <article className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-semibold">Vocabulary review</h2><p className="mt-1 text-sm text-slate-400">Phrase retrieval is shown separately from Error Pattern Review.</p><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Enrolled" value={vocabulary.current.enrolled} /><Metric label="Due / overdue" value={`${vocabulary.current.dueNow} / ${vocabulary.current.overdue}`} /><Metric label="Mastered / returned" value={`${vocabulary.current.mastered} / ${vocabulary.current.returned}`} /><Metric label="Correct / incorrect" value={`${vocabulary.events.correct} / ${vocabulary.events.incorrect}`} /></div><p className="mt-4 text-sm text-slate-400">Scheduled: {vocabulary.events.scheduled} · Practice Now: {vocabulary.events.practiceNow} · Success rate: {percentage(vocabulary.events.successRate)}</p><Link className="mt-4 inline-flex text-sm text-cyan-200 underline" href="/vocabulary">Open vocabulary review</Link></article>
      <article className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-semibold">Writing</h2><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Analyses" value={writing.analyses} /><Metric label="Revisions" value={writing.revisions} /><Metric label="High-confidence findings" value={writing.highConfidenceFindings} /><Metric label="Average per analysis" value={writing.averageHighConfidenceFindings === null ? "Not enough evidence" : writing.averageHighConfidenceFindings.toFixed(1)} /></div><p className="mt-4 text-sm text-slate-300">Resolved in this revision: {writing.resolvedInRevisions} · Still remaining: {writing.remainingInRevisions}</p><p className="mt-2 text-sm text-slate-400">Revision resolution rate: {percentage(writing.resolutionRate)}</p></article>
      <article className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-semibold">Listening</h2><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Dictations" value={listening.dictations} /><Metric label="Dictation accuracy" value={listening.averageAccuracy === null ? "Not enough evidence" : `${listening.averageAccuracy}%`} /><Metric label="Shadowing repetitions" value={listening.shadowingRepetitions} /><Metric label="Correct / nearly there / try again" value={`${listening.status.correct} / ${listening.status.nearly_there} / ${listening.status.try_again}`} /></div><p className="mt-4 text-sm text-slate-400">{trendLabel(snapshot)}</p></article>
    </section>
    <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-5" aria-label="Learning balance"><h2 className="text-xl font-semibold">Learning balance</h2><p className="mt-1 text-sm text-slate-400">Completed activities in this range, not proficiency.</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Lessons" value={balance.lessons} /><Metric label="Writing" value={balance.writing} /><Metric label="Review" value={balance.review} /><Metric label="Listening" value={balance.listening} /></div></section>
    <Timeline snapshot={snapshot} />
  </>;
}

export function ProgressScreen() {
  const [range, setRange] = useState<ProgressRange>("7d");
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    void loadProgressSourceData({ lessonStore: createBrowserLessonStore(), writingSessionStore: createBrowserWritingSessionStore(), errorMemoryStore: createBrowserErrorMemoryStore(), reviewStore: createBrowserReviewStore(), phraseStore: createBrowserPhraseStore(), vocabularyReviewStore: createBrowserVocabularyReviewStore(), listeningStore: createBrowserListeningStore() })
      .then((source) => buildProgressSnapshot(source, { range, now: new Date().toISOString(), timeZone }))
      .then((next) => { if (active) setSnapshot(next); })
      .catch(() => { if (active) setSnapshot(buildProgressSnapshot({ lessons: [], writingSessions: [], errorPatterns: [], reviewItems: [], reviewEvents: [], vocabularyReviewItems: [], vocabularyReviewEvents: [], vocabularyPhraseIds: [], listeningAttempts: [], shadowingEvents: [] }, { range, now: new Date().toISOString(), timeZone })); });
    return () => { active = false; };
  }, [range]);

  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-6xl"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-6"><div><p className="text-sm font-semibold tracking-[0.2em] text-cyan-300 uppercase">EngCyber</p><h1 className="mt-2 text-3xl font-semibold">Progress</h1></div><Link className="rounded border border-cyan-300 px-4 py-2 text-sm text-cyan-200" href="/">Discover</Link></header><p className="mt-6 max-w-3xl text-slate-300">A browser-local view of completed learning evidence. It does not estimate your level or send learning history anywhere.</p><div className="mt-5 flex flex-wrap gap-2" aria-label="Date range">{ranges.map((entry) => <button className={`rounded border px-4 py-2 text-sm ${range === entry.id ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-slate-600 text-slate-200"}`} key={entry.id} onClick={() => setRange(entry.id)}>{entry.label}</button>)}</div>{snapshot ? <ProgressContent snapshot={snapshot} /> : <p className="mt-8 text-slate-400">Loading browser-local learning evidence…</p>}</div></main>;
}
