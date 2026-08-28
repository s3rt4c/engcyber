"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserErrorMemoryStore } from "@/client/local-error-memory-store";
import { createBrowserLessonStore } from "@/client/local-lesson-store";
import { createBrowserListeningStore } from "@/client/local-listening-store";
import { createBrowserIeltsPracticeStore } from "@/client/local-ielts-practice-store";
import { createBrowserPhraseStore } from "@/client/local-phrase-store";
import { createBrowserReviewStore } from "@/client/local-review-store";
import { createBrowserVocabularyReviewStore } from "@/client/local-vocabulary-review-store";
import { createBrowserWritingSessionStore } from "@/client/local-writing-session-store";
import { buildDailyHub, loadLocalLearningData, type DailyHub } from "@/client/local-learning-loaders";

export function DailyLearningHub() {
  const [hub, setHub] = useState<DailyHub | null>(null);
  useEffect(() => {
    let active = true;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    void loadLocalLearningData({ lessonStore: createBrowserLessonStore(), phraseStore: createBrowserPhraseStore(), writingSessionStore: createBrowserWritingSessionStore(), errorMemoryStore: createBrowserErrorMemoryStore(), reviewStore: createBrowserReviewStore(), vocabularyReviewStore: createBrowserVocabularyReviewStore(), listeningStore: createBrowserListeningStore(), ieltsPracticeStore: createBrowserIeltsPracticeStore() })
      .then((data) => buildDailyHub(data, { now: new Date().toISOString(), timeZone }))
      .then((next) => { if (active) setHub(next); });
    return () => { active = false; };
  }, []);
  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-4xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">EngCyber</p><h1 className="mt-2 text-3xl font-semibold">Today</h1><p className="mt-3 max-w-2xl text-slate-300">Choose one useful next step from the learning work saved in this browser.</p>{!hub ? <p className="mt-8 text-slate-400">Loading your browser-local learning activity…</p> : <div className="mt-8 space-y-8">
    <section aria-label="Continue"><h2 className="text-xl font-semibold">Continue</h2>{hub.continueItems.length ? <div className="mt-3 grid gap-3">{hub.continueItems.map((item) => <Link className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-cyan-200 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href={item.href} key={`${item.kind}-${item.href}`}>{item.label}</Link>)}</div> : <p className="mt-3 text-sm text-slate-400">No saved activity needs a specific next step yet.</p>}</section>
    {hub.ieltsContinuations.length > 0 && <section aria-labelledby="continue-ielts-heading"><h2 className="text-xl font-semibold" id="continue-ielts-heading">Continue IELTS Practice</h2><div className="mt-3 grid gap-3">{hub.ieltsContinuations.map((item) => <Link className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-cyan-200 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href={item.href} key={item.id}><span className="block font-medium">{item.title}</span><span className="mt-1 block text-sm text-slate-400">{item.subtitle}</span></Link>)}</div></section>}
    <section aria-label="Review"><h2 className="text-xl font-semibold">Review</h2><p className="mt-3 text-slate-300">{hub.review.overdue ? `${hub.review.overdue} overdue` : "No overdue reviews"} · {hub.review.dueNow} due now</p><Link className="mt-3 inline-flex rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" href="/review">Start Review</Link></section>
    <section aria-label="Vocabulary"><h2 className="text-xl font-semibold">Vocabulary</h2><p className="mt-3 text-slate-300">{hub.vocabulary.overdue ? `${hub.vocabulary.overdue} overdue` : "No overdue vocabulary reviews"} · {hub.vocabulary.dueNow} due now</p><Link className="mt-3 inline-flex rounded border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" href="/vocabulary">Practice vocabulary</Link></section>
    {hub.focus.length > 0 && <section aria-label="Focus"><h2 className="text-xl font-semibold">Focus</h2><div className="mt-3 grid gap-3">{hub.focus.map((item) => <Link className="rounded-xl border border-cyan-400/30 bg-slate-900 p-4 text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href={item.href} key={item.kind}>{item.message}</Link>)}</div></section>}
    <section aria-label="Recent lessons"><h2 className="text-xl font-semibold">Recent lessons</h2>{hub.recentLessons.length ? <div className="mt-3 grid gap-3">{hub.recentLessons.map((item) => <article className="rounded-xl border border-slate-800 bg-slate-900 p-4" key={item.lesson.id}><h3 className="font-medium">{item.title}</h3><p className="mt-1 text-sm text-slate-400">Saved {new Date(item.lesson.createdAt).toLocaleDateString()}</p><Link className="mt-3 inline-flex text-sm text-cyan-200 underline" href={`/library/lessons/${encodeURIComponent(item.lesson.id)}`}>Open lesson</Link></article>)}</div> : <p className="mt-3 text-sm text-slate-400">Create a lesson from a reading or transcript to see it here.</p>}</section>
    <section aria-label="Discover"><h2 className="text-xl font-semibold">Discover</h2><p className="mt-2 text-slate-300">Find something new to read or add material you are allowed to study.</p><div className="mt-3 flex flex-wrap gap-3"><Link className="rounded border border-cyan-300 px-4 py-2 text-sm text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href="/discover">Find something new to read</Link><Link className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href="/add-content">Add Content</Link></div></section>
    <section aria-label="IELTS Practice"><h2 className="text-xl font-semibold">IELTS Practice</h2><p className="mt-2 text-slate-300">Practice Reading, Writing Task 2, and Listening skills without an estimated band or readiness score.</p><Link className="mt-3 inline-flex rounded border border-cyan-300 px-4 py-2 text-sm text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href="/ielts">Open IELTS Practice</Link></section>
  </div>}</div></main>;
}
