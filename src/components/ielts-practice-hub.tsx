"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { openCachedOrGeneratedIeltsReading } from "@/client/ielts-reading-flow";
import { createBrowserIeltsPracticeStore } from "@/client/local-ielts-practice-store";
import { createBrowserLessonStore } from "@/client/local-lesson-store";
import { ieltsReadingSourceProblem, ieltsTask2PromptBank, type IeltsReadingPractice, type IeltsWritingSession, wordCountForIelts } from "@/domain/ielts";
import type { StoredLesson } from "@/domain/lesson";

function id() { return globalThis.crypto?.randomUUID?.() ?? `ielts-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function IeltsPracticeHub() {
  const router = useRouter();
  const [writing, setWriting] = useState<IeltsWritingSession[]>([]);
  const [reading, setReading] = useState<IeltsReadingPractice[]>([]);
  const [lessons, setLessons] = useState<StoredLesson[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState(ieltsTask2PromptBank[0].id);
  const [notice, setNotice] = useState("");
  const [busyLesson, setBusyLesson] = useState<string | null>(null);
  const prompt = ieltsTask2PromptBank.find((entry) => entry.id === selectedPromptId)!;
  const reload = async () => { const store = createBrowserIeltsPracticeStore(); const [savedWriting, savedReading, savedLessons] = await Promise.all([store.listWriting(), store.listReading(), createBrowserLessonStore().list()]); setWriting([...savedWriting]); setReading([...savedReading]); setLessons([...savedLessons]); };
  useEffect(() => { let active = true; void Promise.all([createBrowserIeltsPracticeStore().listWriting(), createBrowserIeltsPracticeStore().listReading(), createBrowserLessonStore().list()]).then(([savedWriting, savedReading, savedLessons]) => { if (active) { setWriting([...savedWriting]); setReading([...savedReading]); setLessons([...savedLessons]); } }); return () => { active = false; }; }, []);
  const saveDraft = async () => { const now = new Date().toISOString(); const saved = await createBrowserIeltsPracticeStore().saveWriting({ id: id(), promptId: prompt.id, promptType: prompt.type, draft, revisedDraft: null, initialFeedback: null, revisionFeedback: null, initialAnalyzedAt: null, revisionReviewedAt: null, elapsedSeconds: null, createdAt: now, updatedAt: now }); setNotice(saved ? "Task 2 draft saved in this browser." : "Browser storage is unavailable."); if (saved) { setDraft(""); await reload(); } };
  const createReading = async (lesson: StoredLesson) => {
    if (!lesson.context) return setNotice("This older saved lesson has no retained source context, so IELTS Reading cannot be created without fetching it again.");
    const problem = ieltsReadingSourceProblem(lesson.context.sourceText);
    if (problem) return setNotice(problem);
    setBusyLesson(lesson.id); setNotice("");
    try {
      const identityResponse = await fetch("/api/ielts/reading/identity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonContext: lesson.context }) });
      const identity = await identityResponse.json() as { generationFingerprint?: string; error?: string };
      if (!identityResponse.ok || !identity.generationFingerprint) throw new Error(identity.error ?? "IELTS Reading identity failed.");
      const opened = await openCachedOrGeneratedIeltsReading({ generationFingerprint: identity.generationFingerprint, store: createBrowserIeltsPracticeStore(), generate: async () => {
        const response = await fetch("/api/ielts/reading/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonContext: lesson.context }) });
        const data = await response.json() as { questions?: unknown; generationFingerprint?: string; source?: { id: string; fingerprint: string; title: string; url: string | null }; error?: string };
        if (!response.ok || !Array.isArray(data.questions) || !data.generationFingerprint || !data.source) throw new Error(data.error ?? "IELTS Reading generation failed.");
        const now = new Date().toISOString();
        return { id: id(), generationFingerprint: data.generationFingerprint, sourceId: data.source.id, sourceFingerprint: data.source.fingerprint, sourceTitle: data.source.title, sourceUrl: data.source.url, questions: data.questions as never, answers: {}, completedAt: null, elapsedSeconds: null, createdAt: now, updatedAt: now };
      } });
      router.push(`/ielts/reading/${opened.practice.id}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "IELTS Reading generation failed."); } finally { setBusyLesson(null); }
  };
  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-4xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">IELTS-oriented practice</p><h1 className="mt-2 text-3xl font-semibold">IELTS Practice</h1><p className="mt-3 max-w-3xl text-slate-300">Practice evidence is not an IELTS band, CEFR level, or official assessment. This browser-local workspace sends writing only when you explicitly request analysis.</p>{notice && <p role="status" className="mt-4 text-sm text-amber-200">{notice}</p>}
    <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-semibold">Reading</h2><p className="mt-2 text-slate-300">Create IELTS-style practice from an eligible saved lesson. Source context is reused locally; opening this page makes no provider request.</p><div className="mt-4 space-y-3">{lessons.length ? lessons.map((lesson) => { const problem = lesson.context ? ieltsReadingSourceProblem(lesson.context.sourceText) : "Older lesson: retained source context is unavailable."; return <div className="rounded border border-slate-700 p-3" key={lesson.id}><p className="font-medium">{lesson.context?.title ?? lesson.contentId}</p><p className="mt-1 text-sm text-slate-400">{problem ?? "Eligible saved context"}</p><button className="mt-3 rounded border border-cyan-300 px-3 py-2 text-sm text-cyan-100 disabled:opacity-50" disabled={Boolean(problem) || busyLesson === lesson.id} onClick={() => void createReading(lesson)}>{busyLesson === lesson.id ? "Creating…" : "Create IELTS-style Reading Practice"}</button></div>; }) : <p className="text-sm text-slate-400">Save a lesson first to reuse its bounded source context here.</p>}</div>{reading.length > 0 && <ul className="mt-5 space-y-2">{reading.map((practice) => <li key={practice.id}><Link className="text-sm text-cyan-200 underline" href={`/ielts/reading/${practice.id}`}>{practice.completedAt ? "Review completed" : "Continue"} Reading: {practice.sourceTitle}</Link></li>)}</ul>}</section>
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-semibold">Writing Task 2</h2><p className="mt-2 text-sm text-slate-400">Choose an application-owned prompt. Target: at least 250 words. The optional timer starts only when you choose it; feedback starts only after you explicitly request it.</p><label className="mt-4 block text-sm">Prompt<select className="mt-2 block w-full rounded border border-slate-700 bg-slate-950 p-2" value={selectedPromptId} onChange={(event) => setSelectedPromptId(event.target.value)}>{ieltsTask2PromptBank.map((entry) => <option key={entry.id} value={entry.id}>{entry.type.replaceAll("_", " ")} · {entry.category}</option>)}</select></label><p className="mt-3 leading-7">{prompt.task}</p><label className="mt-4 block text-sm" htmlFor="ielts-task2-draft">Your response<textarea id="ielts-task2-draft" className="mt-2 min-h-48 w-full rounded border border-slate-700 bg-slate-950 p-3" value={draft} onChange={(event) => setDraft(event.target.value)} /></label><p className={`mt-2 text-sm ${wordCountForIelts(draft) < 250 ? "text-amber-200" : "text-slate-400"}`}>Word count: {wordCountForIelts(draft)} · Target: at least 250 words</p><button className="mt-4 rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={!draft.trim()} onClick={() => void saveDraft()}>Save Task 2 draft</button></section>
    <section className="mt-6"><h2 className="text-xl font-semibold">Recent Task 2 drafts</h2>{writing.length ? <ul className="mt-3 space-y-2">{writing.map((session) => <li className="rounded border border-slate-800 bg-slate-900 p-3" key={session.id}><Link className="text-cyan-200 underline" href={`/ielts/writing/${session.id}`}>{session.promptType.replaceAll("_", " ")} · {wordCountForIelts(session.draft)} words · {session.initialFeedback ? "Continue feedback" : "Analyze draft"}</Link></li>)}</ul> : <p className="mt-3 text-sm text-slate-400">No Task 2 draft is saved in this browser yet.</p>}</section>
  </div></main>;
}
