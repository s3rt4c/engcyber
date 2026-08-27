"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { createBrowserSpeechSynthesis, type BrowserSpeechSynthesis } from "@/client/browser-tts";
import { canPersistIeltsListeningSession, markCurrentIeltsListeningPlaybackStarted, submitIeltsListeningSession, updateIeltsListeningAnswer } from "@/client/ielts-listening-flow";
import { createBrowserIeltsPracticeStore } from "@/client/local-ielts-practice-store";
import { gradeIeltsListeningAnswers, normalizeIeltsListeningCompletionAnswer, type IeltsListeningSession } from "@/domain/ielts-listening";
import { ieltsListeningPracticeBank } from "@/domain/ielts-listening-bank";

export function IeltsListeningPractice({ sessionId }: { readonly sessionId: string }) {
  const [session, setSession] = useState<IeltsListeningSession | null>(null);
  const [audioAvailable, setAudioAvailable] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");
  const speech = useRef<BrowserSpeechSynthesis | null>(null);
  const currentSession = useRef<IeltsListeningSession | null>(null);
  useEffect(() => {
    let active = true;
    const controller = createBrowserSpeechSynthesis();
    speech.current = controller;
    void Promise.resolve().then(() => { if (active) setAudioAvailable(controller.supported); });
    return () => { active = false; controller.dispose(); };
  }, []);
  useEffect(() => { let active = true; void createBrowserIeltsPracticeStore().getListening(sessionId).then((saved) => { if (active) { currentSession.current = saved; setSession(saved); } }); return () => { active = false; }; }, [sessionId]);
  const definition = session ? ieltsListeningPracticeBank.find((entry) => entry.id === session.practiceDefinitionId) ?? null : null;
  const save = async (next: IeltsListeningSession) => {
    const prior = currentSession.current;
    if (!canPersistIeltsListeningSession(prior, next)) return true;
    currentSession.current = next;
    const ok = await createBrowserIeltsPracticeStore().saveListening(next);
    if (ok) setSession(next);
    else {
      if (currentSession.current === next) currentSession.current = prior;
      setNotice("Browser storage is unavailable.");
    }
    return ok;
  };
  const play = () => {
    if (!session || !definition || session.completedAt) return;
    const now = new Date().toISOString();
    const started = speech.current?.speakSequence(definition.scriptTurns.map((turn) => turn.text), 1, {
      onStart: () => {
        const current = markCurrentIeltsListeningPlaybackStarted(currentSession.current, session.id, now);
        if (current) void save(current).then((ok) => { if (ok) setNotice("Audio playback started. Replay is allowed."); });
      },
      onError: () => { setAudioAvailable(false); setNotice("Audio practice is unavailable on this browser or device."); },
    }) ?? false;
    if (!started) { setAudioAvailable(false); setNotice("Audio practice is unavailable on this browser or device."); }
  };
  const answer = (questionId: string, value: string) => { if (!session || session.completedAt) return; void save(updateIeltsListeningAnswer(session, questionId, value, new Date().toISOString())); };
  const submit = () => { if (!session || !definition) return; const result = submitIeltsListeningSession({ session, definition, now: new Date().toISOString() }); if (!result.submitted) { setNotice(result.error); return; } void save(result.session).then((ok) => { if (ok) setNotice(""); }); };
  if (!session || !definition) return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-3xl"><Link className="text-cyan-200 underline" href="/ielts/listening">Listening mini-practices</Link><p className="mt-8 text-slate-400">This Listening practice is unavailable in this browser.</p></div></main>;
  const completed = session.completedAt !== null;
  const result = completed ? gradeIeltsListeningAnswers(definition, session.answers) : null;
  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-3xl"><Link className="text-cyan-200 underline" href="/ielts/listening">Listening mini-practices</Link><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">IELTS-oriented Listening</p><h1 className="mt-2 text-3xl font-semibold">{definition.title}</h1><p className="mt-3 text-sm text-slate-400">Browser-synthesized audio · learning mode · not official IELTS recording material.</p>{notice && <p className="mt-4 rounded border border-amber-400/30 bg-amber-950/30 p-3 text-sm text-amber-100" role="status">{notice}</p>}
    {audioAvailable === null ? <p className="mt-8 text-slate-400">Preparing browser audio…</p> : audioAvailable === false ? <section className="mt-8 rounded border border-slate-700 bg-slate-900 p-4" role="status"><h2 className="font-semibold">Audio practice is unavailable on this browser or device.</h2><p className="mt-2 text-sm text-slate-300">Try another supported browser or device. The transcript stays unavailable until a completed Listening practice.</p></section> : <><section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5"><button className="rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" disabled={completed} onClick={play}>{session.playbackCount ? "Replay audio" : "Play audio"}</button><p className="mt-3 text-sm text-slate-400">Replay is allowed and does not affect your result.</p></section>
      <ol className="mt-8 space-y-6">{definition.questions.map((question, index) => <li className="rounded-xl border border-slate-800 bg-slate-900 p-5" key={question.id}><p className="font-medium">{index + 1}. {question.prompt}</p>{question.type === "multiple_choice" ? <div className="mt-4 space-y-2">{question.options.map((option) => <label className="flex gap-2" key={option.id}><input type="radio" name={question.id} disabled={completed} checked={session.answers[question.id] === option.id} onChange={() => answer(question.id, option.id)} />{option.text}</label>)}</div> : <label className="mt-4 block text-sm" htmlFor={question.id}>Your answer<input id={question.id} className="mt-2 block w-full rounded border border-slate-700 bg-slate-950 p-2" disabled={completed} value={session.answers[question.id] ?? ""} onChange={(event) => answer(question.id, event.target.value)} /></label>}{completed && <section className="mt-4 rounded border border-slate-700 bg-slate-950 p-4" aria-label={`Review for question ${index + 1}`}><p className="font-medium">{question.type === "multiple_choice" ? session.answers[question.id] === question.correctOptionId ? "Correct." : `Your answer: ${question.options.find((option) => option.id === session.answers[question.id])?.text ?? "No answer"}. Correct answer: ${question.options.find((option) => option.id === question.correctOptionId)?.text}` : question.acceptedAnswers.some((accepted) => normalizeIeltsListeningCompletionAnswer(accepted) === normalizeIeltsListeningCompletionAnswer(session.answers[question.id] ?? "")) ? "Correct." : `Your answer: ${session.answers[question.id] || "No answer"}. Correct answer: ${question.acceptedAnswers[0]}`}</p><p className="mt-2 text-sm text-slate-300">{question.explanation}</p><p className="mt-2 border-l-2 border-cyan-300 pl-3 text-sm text-slate-400">{question.relevantTranscript}</p></section>}</li>)}</ol>
      {completed && result ? <section className="mt-8 rounded-xl border border-cyan-300/40 bg-slate-900 p-5"><h2 className="text-xl font-semibold">{result.correct} of {result.total} correct</h2><section className="mt-5" aria-label="Transcript"><h3 className="font-semibold">Transcript</h3><div className="mt-3 space-y-3 leading-7 text-slate-300">{definition.scriptTurns.map((turn, index) => <p key={`${turn.speakerId}-${index}`}><strong className="text-cyan-200">{definition.speakers.find((speaker) => speaker.id === turn.speakerId)?.label}: </strong>{turn.text}</p>)}</div></section></section> : <button className="mt-8 rounded bg-cyan-300 px-4 py-2 font-semibold text-slate-950" onClick={submit}>Submit answers</button>}</>}
  </div></main>;
}
