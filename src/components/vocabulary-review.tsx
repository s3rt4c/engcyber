"use client";

import { useEffect, useMemo, useState } from "react";

import { createBrowserPhraseStore } from "@/client/local-phrase-store";
import { createBrowserVocabularyReviewStore } from "@/client/local-vocabulary-review-store";
import { enrollPhraseForVocabularyReview, recordVocabularyReviewOutcome } from "@/client/vocabulary-review-flow";
import type { SavedPhrase } from "@/domain/boundaries";
import { buildVocabularyExercise, gradeVocabularyAnswer, queueVocabularyReviewItems, vocabularyReviewCurrentState, type VocabularyReviewItem } from "@/domain/vocabulary-review";

type LoadedVocabulary = {
  readonly phrases: readonly SavedPhrase[];
  readonly items: readonly VocabularyReviewItem[];
};

function eventId(): string {
  const cryptoApi = typeof globalThis.crypto === "undefined" ? null : globalThis.crypto;
  return typeof cryptoApi?.randomUUID === "function" ? cryptoApi.randomUUID() : `vocabulary-event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function statusLabel(status: VocabularyReviewItem["status"]): string {
  return status === "learning" ? "Learning" : status === "reviewing" ? "In review" : status === "mastered" ? "Long review" : "Returned";
}

export function VocabularyReview() {
  const [data, setData] = useState<LoadedVocabulary | null>(null);
  const [activePhraseId, setActivePhraseId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    const [phrases, snapshot] = await Promise.all([createBrowserPhraseStore().list(), createBrowserVocabularyReviewStore().snapshot()]);
    setData({ phrases, items: snapshot.items });
  };

  useEffect(() => {
    let active = true;
    void Promise.all([createBrowserPhraseStore().list(), createBrowserVocabularyReviewStore().snapshot()]).then(([phrases, snapshot]) => {
      if (!active) {
        return;
      }
      setData({ phrases, items: snapshot.items });
      const requestedPhraseId = new URLSearchParams(window.location.search).get("phrase");
      if (requestedPhraseId && snapshot.items.some((item) => item.phraseId === requestedPhraseId) && phrases.some((phrase) => phrase.id === requestedPhraseId)) {
        setActivePhraseId(requestedPhraseId);
      }
    });
    return () => { active = false; };
  }, []);

  const now = new Date().toISOString();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const phraseById = useMemo(() => new Map(data?.phrases.map((phrase) => [phrase.id, phrase]) ?? []), [data]);
  const dueItems = useMemo(() => data ? queueVocabularyReviewItems(data.items, data.phrases, now) : [], [data, now]);
  const state = useMemo(() => data ? vocabularyReviewCurrentState(data.items, data.phrases, now, timeZone) : null, [data, now, timeZone]);
  const activePhrase = activePhraseId ? phraseById.get(activePhraseId) ?? null : null;
  const exercise = activePhrase ? buildVocabularyExercise(activePhrase) : null;

  const start = (phraseId: string) => {
    setActivePhraseId(phraseId);
    setAnswer("");
    setResult(null);
    setMessage(null);
  };

  const enroll = async (phraseId: string) => {
    const outcome = await enrollPhraseForVocabularyReview({ phraseId, phraseStore: createBrowserPhraseStore(), reviewStore: createBrowserVocabularyReviewStore(), now: new Date().toISOString() });
    setMessage(outcome === "enrolled" ? "Added to vocabulary review. Your first retrieval is due tomorrow." : outcome === "already_enrolled" ? "This phrase is already in vocabulary review." : outcome === "limit_reached" ? "Vocabulary review has reached its local 200-item limit." : outcome === "missing_phrase" ? "This saved phrase is no longer available." : "Vocabulary review storage is unavailable in this browser.");
    await reload();
  };

  const checkAnswer = async () => {
    if (!activePhrase || !answer.trim()) {
      setMessage("Type the saved phrase before checking your answer.");
      return;
    }

    const outcome = gradeVocabularyAnswer(answer, activePhrase.phrase) ? "correct" : "incorrect";
    const recorded = await recordVocabularyReviewOutcome({ phraseId: activePhrase.id, outcome, reviewStore: createBrowserVocabularyReviewStore(), reviewedAt: new Date().toISOString(), eventId: eventId() });
    if (recorded !== "recorded") {
      setMessage(recorded === "missing_item" ? "This phrase is not enrolled in vocabulary review." : "Vocabulary review storage is unavailable in this browser.");
      return;
    }

    setResult(outcome);
    setMessage(null);
    await reload();
  };

  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-4xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Saved phrases</p><h1 className="mt-2 text-3xl font-semibold">Vocabulary review</h1><p className="mt-3 max-w-2xl text-sm text-slate-400">Saved phrases stay in this browser. Review uses exact phrase retrieval and never contacts an AI provider.</p>{!data ? <p className="mt-8 text-slate-400">Loading browser-local vocabulary…</p> : <div className="mt-8 space-y-8">
    <section aria-label="Vocabulary due state" className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-semibold">Today</h2><p className="mt-2 text-slate-300">{state?.overdue ? `${state.overdue} overdue` : "No overdue vocabulary reviews"} · {state?.dueNow ?? 0} due now</p>{dueItems.length > 0 && <button className="mt-4 rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" onClick={() => start(dueItems[0]!.phraseId)}>Start vocabulary review</button>}</section>
    {message && <p role="status" className="rounded border border-amber-300/40 bg-amber-200/10 p-3 text-sm text-amber-100">{message}</p>}
    {activePhrase && exercise && <section aria-label="Vocabulary exercise" className="rounded-xl border border-cyan-400/30 bg-slate-900 p-5"><h2 className="text-xl font-semibold">Practice</h2><p className="mt-3 text-sm text-slate-300">{exercise.prompt}</p>{exercise.context && <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-4 leading-7 text-slate-200">{exercise.context}</p>}<label className="mt-5 block text-sm font-medium" htmlFor="vocabulary-answer">Your answer</label><input className="mt-2 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100" id="vocabulary-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" /><button className="mt-3 rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" onClick={() => void checkAnswer()}>Check answer</button>{result && <p className={`mt-4 text-sm ${result === "correct" ? "text-emerald-200" : "text-amber-100"}`}>{result === "correct" ? "Correct. Your next review has been scheduled." : <>Not quite. The saved phrase is <strong>{activePhrase.phrase}</strong>.</>}</p>}</section>}
    <section aria-label="Saved vocabulary"><h2 className="text-xl font-semibold">Your saved phrases</h2>{data.phrases.length ? <div className="mt-4 grid gap-4">{data.phrases.map((phrase) => { const item = data.items.find((candidate) => candidate.phraseId === phrase.id); return <article className="rounded-xl border border-slate-800 bg-slate-900 p-5" key={phrase.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium text-cyan-200">{phrase.phrase}</h3><p className="mt-2 text-sm text-slate-300">{phrase.context}</p><p className="mt-2 text-sm text-slate-400">{phrase.sourceTitle}</p></div>{item && <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">{statusLabel(item.status)}</span>}</div><div className="mt-4 flex flex-wrap gap-3">{item ? <button className="text-sm text-cyan-200 underline" onClick={() => start(phrase.id)}>{new Date(item.dueAt).getTime() <= new Date().getTime() ? "Practice now" : "Practice"}</button> : <button className="text-sm text-cyan-200 underline" onClick={() => void enroll(phrase.id)}>Add to review</button>}</div></article>; })}</div> : <p className="mt-3 text-sm text-slate-400">Save a phrase from reading or a lesson before adding it to vocabulary review.</p>}</section>
  </div>}</div></main>;
}
