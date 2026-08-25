"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserErrorMemoryStore } from "@/client/local-error-memory-store";
import { createBrowserLessonStore } from "@/client/local-lesson-store";
import { createBrowserListeningStore } from "@/client/local-listening-store";
import { createBrowserPhraseStore } from "@/client/local-phrase-store";
import { createBrowserReviewStore } from "@/client/local-review-store";
import { createBrowserWritingSessionStore } from "@/client/local-writing-session-store";
import { buildLibrary, loadLocalLearningData, type LibraryData } from "@/client/local-learning-loaders";
import { safeExternalHttpUrl } from "@/domain/safe-link";

export function LearningLibrary() {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const readers = () => ({ lessonStore: createBrowserLessonStore(), phraseStore: createBrowserPhraseStore(), writingSessionStore: createBrowserWritingSessionStore(), errorMemoryStore: createBrowserErrorMemoryStore(), reviewStore: createBrowserReviewStore(), listeningStore: createBrowserListeningStore() });
  const reload = async () => setLibrary(buildLibrary(await loadLocalLearningData(readers())));
  useEffect(() => { void loadLocalLearningData(readers()).then((data) => setLibrary(buildLibrary(data))); }, []);
  const removePhrase = async (id: string) => { await createBrowserPhraseStore().delete(id); await reload(); };
  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-4xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">My Learning</p><h1 className="mt-2 text-3xl font-semibold">Library</h1><p className="mt-3 text-sm text-slate-400">Saved in this browser.</p>{!library ? <p className="mt-8 text-slate-400">Loading saved learning material…</p> : <div className="mt-8 space-y-10">
    <section aria-label="Lessons"><h2 className="text-xl font-semibold">Lessons</h2>{library.lessons.length ? <div className="mt-4 grid gap-4">{library.lessons.map((item) => <article className="rounded-xl border border-slate-800 bg-slate-900 p-5" key={item.lesson.id}><p className="text-xs uppercase tracking-wide text-cyan-300">{item.category?.replaceAll("_", " ") ?? "Saved lesson"}</p><h3 className="mt-2 text-lg font-medium">{item.title}</h3>{item.sourceLabel && <p className="mt-1 text-sm text-slate-400">{item.sourceLabel}</p>}<p className="mt-2 text-sm text-slate-400">Saved {new Date(item.lesson.createdAt).toLocaleDateString()}</p>{!item.contextAvailable && <p className="mt-3 text-sm text-amber-200">Source context unavailable for this older saved lesson.</p>}<div className="mt-4 flex flex-wrap gap-3"><Link className="text-sm text-cyan-200 underline" href={`/library/lessons/${encodeURIComponent(item.lesson.id)}`}>Open lesson</Link><Link className="text-sm text-cyan-200 underline" href={`/listening?lesson=${encodeURIComponent(item.lesson.generationFingerprint)}`}>Listening</Link>{item.writingAction && <Link className={`text-sm underline ${item.writingAction.enabled ? "text-cyan-200" : "pointer-events-none text-slate-500"}`} aria-disabled={!item.writingAction.enabled} href={`/library/lessons/${encodeURIComponent(item.lesson.id)}`}>{item.writingAction.label}</Link>}</div></article>)}</div> : <p className="mt-3 text-sm text-slate-400">Your saved lessons will appear here after you explicitly create them.</p>}</section>
    <section aria-label="Saved phrases"><h2 className="text-xl font-semibold">Saved phrases</h2>{library.phrases.length ? <div className="mt-4 grid gap-4">{library.phrases.map((phrase) => { const sourceUrl = safeExternalHttpUrl(phrase.sourceUrl); return <article className="rounded-xl border border-slate-800 bg-slate-900 p-5" key={phrase.id}><h3 className="font-medium text-cyan-200">{phrase.phrase}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{phrase.context}</p><p className="mt-2 text-sm text-slate-400">{phrase.sourceTitle} · Saved {new Date(phrase.savedAt).toLocaleDateString()}</p><div className="mt-3 flex flex-wrap gap-3">{sourceUrl && <a className="text-sm text-cyan-200 underline" href={sourceUrl} target="_blank" rel="noreferrer">Original source</a>}<button className="text-sm text-rose-200 underline" onClick={() => void removePhrase(phrase.id)}>Delete</button></div></article>; })}</div> : <p className="mt-3 text-sm text-slate-400">Save a phrase from a reading or lesson to keep it here.</p>}</section>
  </div>}</div></main>;
}
