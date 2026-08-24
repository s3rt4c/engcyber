"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { BrowserSpeechSynthesis, createBrowserSpeechSynthesis } from "@/client/browser-tts";
import { createBrowserLessonStore } from "@/client/local-lesson-store";
import { createBrowserListeningStore, type ListeningSnapshot } from "@/client/local-listening-store";
import { checkListeningDictation, createOrResumeListeningSession, findResumableListeningLesson, recordShadowingRepetition } from "@/client/listening-flow";
import { chunkForShadowing, defaultListeningPlaybackRate, isSupportedListeningPlaybackRate, listeningPlaybackRates, listeningSessionAverageAccuracy, recordDictationAttempt, type DictationResult, type ListeningSession } from "@/domain/listening";
import type { StoredLesson } from "@/domain/lesson";

function identifier(prefix: string): string {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function differenceText(difference: DictationResult["differences"][number]): string {
  if (difference.kind === "substitution") return `${difference.target} → ${difference.learner}`;
  return difference.kind === "missing" ? `Missing: ${difference.target}` : `Extra: ${difference.learner}`;
}

function initialExerciseIndex(session: ListeningSession): number {
  const index = session.exercises.findIndex((exercise) => !session.completedExerciseIds.includes(exercise.id));
  return index < 0 ? 0 : index;
}

export function ListeningPractice() {
  const [lessons, setLessons] = useState<StoredLesson[]>([]);
  const [snapshot, setSnapshot] = useState<ListeningSnapshot | null>(null);
  const [session, setSession] = useState<ListeningSession | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<DictationResult | null>(null);
  const [notice, setNotice] = useState("");
  const [speechStatus, setSpeechStatus] = useState<"pending" | "available" | "unavailable">("pending");
  const speech = useRef<BrowserSpeechSynthesis | null>(null);

  useEffect(() => {
    const controller = createBrowserSpeechSynthesis();
    speech.current = controller;
    const timer = window.setTimeout(() => setSpeechStatus(controller.supported ? "available" : "unavailable"), 0);
    return () => { window.clearTimeout(timer); controller.dispose(); };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const store = createBrowserListeningStore();
      const [savedLessons, savedSnapshot] = await Promise.all([createBrowserLessonStore().list(), store.snapshot()]);
      if (!active) return;
      setLessons(savedLessons);
      setSnapshot(savedSnapshot);
      const requestedFingerprint = new URLSearchParams(window.location.search).get("lesson");
      const requestedLesson = requestedFingerprint ? savedLessons.find((lesson) => lesson.generationFingerprint === requestedFingerprint) : undefined;
      const lessonToResume = requestedLesson ?? findResumableListeningLesson({ sessions: savedSnapshot.sessions, lessons: savedLessons });
      if (!lessonToResume) return;
      const result = createOrResumeListeningSession({ sessions: savedSnapshot.sessions, lesson: lessonToResume, now: new Date().toISOString(), createId: () => identifier("listening") });
      const next = { ...savedSnapshot, sessions: [...savedSnapshot.sessions.filter((entry) => entry.id !== result.session.id), result.session] };
      const persisted = await store.save(next);
      if (!active) return;
      if (persisted) { setSnapshot(next); setSession(result.session); setExerciseIndex(initialExerciseIndex(result.session)); }
      else setNotice("Browser storage is unavailable; listening progress will not be saved.");
    })();
    return () => { active = false; };
  }, []);

  const persist = async (next: ListeningSnapshot): Promise<boolean> => {
    const store = createBrowserListeningStore();
    const saved = await store.save(next);
    if (saved) setSnapshot(await store.snapshot());
    else setNotice("Browser storage is unavailable; listening progress was not saved.");
    return saved;
  };

  const openLesson = async (lesson: StoredLesson, fresh = false) => {
    if (!snapshot) return;
    speech.current?.stop();
    const result = createOrResumeListeningSession({ sessions: snapshot.sessions, lesson, now: new Date().toISOString(), createId: () => identifier("listening"), fresh });
    const next = { ...snapshot, sessions: [...snapshot.sessions.filter((entry) => entry.id !== result.session.id), result.session] };
    if (!await persist(next)) return;
    setSession(result.session); setExerciseIndex(initialExerciseIndex(result.session)); setAnswer(""); setFeedback(null); setNotice(result.resumed ? "Resumed your unfinished listening session." : "Listening session created from this saved lesson.");
  };

  const startFresh = () => {
    if (!session) return;
    const lesson = lessons.find((entry) => entry.generationFingerprint === session.lessonGenerationFingerprint);
    if (!lesson) {
      setNotice("This saved lesson is no longer available in this browser.");
      return;
    }
    void openLesson(lesson, true);
  };

  const exercise = session?.exercises[exerciseIndex] ?? null;
  const playbackRate = snapshot?.playbackRate ?? defaultListeningPlaybackRate;

  const setRate = async (value: number) => {
    if (!snapshot || !isSupportedListeningPlaybackRate(value)) return;
    await persist({ ...snapshot, playbackRate: value });
  };

  const play = () => {
    if (!exercise) return;
    if (!speech.current?.speak(exercise.text, playbackRate)) setNotice("Browser speech is unavailable. You can still complete the local dictation practice.");
  };

  const stop = () => speech.current?.stop();

  const checkAnswer = async () => {
    if (!session || !exercise || !snapshot) return;
    const checked = checkListeningDictation({ id: identifier("dictation"), exercise, learnerText: answer, attemptedAt: new Date().toISOString() });
    const nextSession = recordDictationAttempt(session, checked.attempt);
    const next = { ...snapshot, sessions: snapshot.sessions.map((entry) => entry.id === nextSession.id ? nextSession : entry), attempts: [...snapshot.attempts, checked.attempt] };
    if (!await persist(next)) return;
    setSession(nextSession);
    setFeedback({ ...checked.attempt, totalTargetWords: checked.attempt.matchedCount + checked.attempt.missingCount + checked.attempt.substitutionCount, editDistance: checked.attempt.missingCount + checked.attempt.extraCount + checked.attempt.substitutionCount, differences: checked.differences });
  };

  const markShadowing = async () => {
    if (!session || !exercise || !snapshot) return;
    const result = recordShadowingRepetition(session, { id: identifier("shadow"), exerciseId: exercise.id, repeatedAt: new Date().toISOString() });
    const next = { ...snapshot, sessions: snapshot.sessions.map((entry) => entry.id === result.session.id ? result.session : entry), shadowingEvents: [...snapshot.shadowingEvents, result.event] };
    if (!await persist(next)) return;
    setSession(result.session); setNotice("Shadowing repetition recorded as practice.");
  };

  const nextExercise = () => {
    if (!session) return;
    speech.current?.stop();
    setExerciseIndex((index) => Math.min(index + 1, session.exercises.length - 1));
    setAnswer(""); setFeedback(null); setNotice("");
  };

  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-3xl">
    <Link className="text-sm text-cyan-300" href="/">← Discover</Link>
    <h1 className="mt-8 text-3xl font-semibold">Listening Practice</h1>
    <p className="mt-3 max-w-2xl leading-7 text-slate-300">Practice authentic lesson sentences with browser speech, local dictation, and shadowing. This flow does not use an AI provider.</p>
    {notice && <p className="mt-4 rounded border border-amber-400/30 bg-amber-950/30 p-3 text-sm text-amber-100">{notice}</p>}
    {speechStatus === "unavailable" && <p className="mt-4 rounded border border-slate-700 p-3 text-sm text-slate-300">Browser text-to-speech is unavailable. Your transcript, local dictation, and shadowing practice remain accessible.</p>}
    {!session && <section className="mt-8"><h2 className="text-xl font-semibold">Choose a saved lesson</h2>{lessons.length === 0 ? <p className="mt-3 text-slate-300">Create a lesson first, then return here to practise its authentic sentences.</p> : <div className="mt-4 grid gap-3">{lessons.map((lesson) => <article className="rounded-xl border border-slate-800 bg-slate-900 p-4" key={lesson.generationFingerprint}><p className="font-medium">{lesson.lesson.overview}</p><p className="mt-2 text-sm text-slate-400">{lesson.lesson.difficultSentences.length} difficult sentences · {lesson.lesson.keyPhrases.length} useful phrases</p><button className="mt-4 rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" onClick={() => void openLesson(lesson)}>Start listening</button></article>)}</div>}</section>}
    {session && exercise && <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-cyan-300">Sentence {exerciseIndex + 1} of {session.exercises.length}</p><h2 className="mt-1 text-xl font-semibold">Listen and type</h2></div><button className="rounded border border-slate-600 px-3 py-2 text-sm" onClick={startFresh}>Start fresh</button></div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><button className="rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" onClick={play}>Play</button><button className="rounded border border-slate-600 px-4 py-2 text-sm" onClick={play}>Replay</button><button className="rounded border border-slate-600 px-4 py-2 text-sm" onClick={stop}>Stop</button><label className="text-sm text-slate-300">Speed <select className="ml-2 rounded border border-slate-600 bg-slate-950 px-2 py-1" value={playbackRate} onChange={(event) => void setRate(Number(event.target.value))}>{listeningPlaybackRates.map((rate) => <option key={rate} value={rate}>{rate}x</option>)}</select></label></div>
      {!feedback && <div className="mt-6"><label className="block text-sm font-medium" htmlFor="dictation-answer">Type what you heard</label><textarea id="dictation-answer" className="mt-2 min-h-28 w-full rounded border border-slate-700 bg-slate-950 p-3" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type what you heard" /><button className="mt-3 rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" onClick={() => void checkAnswer()}>Check Answer</button></div>}
      {feedback && <div className="mt-6"><p className={feedback.status === "correct" ? "font-medium text-emerald-300" : feedback.status === "nearly_there" ? "font-medium text-amber-200" : "font-medium text-rose-300"}>{feedback.status === "correct" ? "Correct" : feedback.status === "nearly_there" ? "Nearly there" : "Try again"} · {feedback.accuracy}%</p>{feedback.differences.length > 0 && <ul className="mt-3 space-y-1 text-sm text-slate-300">{feedback.differences.map((difference, index) => <li key={`${difference.kind}-${index}`}>{differenceText(difference)}</li>)}</ul>}
        <section className="mt-5 rounded border border-slate-700 bg-slate-950 p-4"><h3 className="font-semibold">Transcript</h3><p className="mt-2 leading-7">{exercise.text}</p></section>
        <section className="mt-5 rounded border border-slate-700 p-4"><h3 className="font-semibold">Shadow this sentence</h3><div className="mt-3 space-y-2 leading-7">{chunkForShadowing(exercise.text).map((chunk, index) => <p key={index}>{chunk.trim()}</p>)}</div><p className="mt-3 text-sm text-slate-400">Repeat the sentence aloud. Pronunciation is not automatically scored.</p><div className="mt-3 flex flex-wrap gap-3"><button className="rounded border border-slate-600 px-3 py-2 text-sm" onClick={play}>Play for shadowing</button><button className="rounded border border-slate-600 px-3 py-2 text-sm" onClick={() => void markShadowing()}>I repeated it aloud</button></div></section>
        {session.completedExerciseIds.length === session.exercises.length ? <section className="mt-6 rounded border border-emerald-400/30 bg-emerald-950/20 p-4"><h3 className="font-semibold text-emerald-200">Listening session complete</h3><p className="mt-2 text-sm text-slate-200">{session.completedExerciseIds.length} sentences completed · Average dictation accuracy: {listeningSessionAverageAccuracy(session)}% · Shadowing repetitions: {session.shadowingRepetitionCount}</p></section> : <button className="mt-5 rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" onClick={nextExercise}>Continue</button>}
      </div>}
    </section>}
  </div></main>;
}
