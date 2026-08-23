"use client";

import { useState } from "react";
import { createBrowserPhraseStore } from "@/client/local-phrase-store";
import { gradeReadingQuestion, type StoredLesson } from "@/domain/lesson";
import type { Content } from "@/domain/models";

export function LessonPanel({ storedLesson, content }: { storedLesson: StoredLesson; content: Content }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");
  const savePhrase = async (phrase: StoredLesson["lesson"]["keyPhrases"][number]) => {
    const result = await createBrowserPhraseStore().save({ phrase: phrase.phrase, context: phrase.articleContext, sourceTitle: content.title, sourceUrl: content.canonicalUrl, contentId: content.id, savedAt: new Date().toISOString() });
    setNotice(result === "saved" ? "Phrase saved on this browser." : result === "duplicate" ? "That phrase is already saved." : "Browser storage is unavailable.");
  };
  return <section className="mx-auto max-w-3xl px-6 pb-12" aria-label="Generated lesson">
    <p className="text-sm text-cyan-300">Generated from the authentic article{storedLesson.sourceTruncated ? " (bounded source excerpt)" : ""}.</p>
    <h2 className="mt-6 text-2xl font-semibold">Overview</h2><p className="mt-3 leading-7 text-slate-200">{storedLesson.lesson.overview}</p>
    <h2 className="mt-10 text-2xl font-semibold">Key phrases</h2><div className="mt-4 grid gap-4">{storedLesson.lesson.keyPhrases.map((phrase) => <article className="rounded-xl border border-slate-800 bg-slate-900 p-4" key={phrase.phrase}><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold text-cyan-200">{phrase.phrase}</h3><button className="rounded border border-slate-600 px-3 py-1 text-sm" onClick={() => savePhrase(phrase)}>Save phrase</button></div><p className="mt-2 text-sm">{phrase.meaningSimpleEnglish}</p><p className="mt-1 text-sm text-slate-400">Turkish: {phrase.meaningTurkish}</p><p className="mt-3 text-sm text-slate-300">In article: {phrase.articleContext}</p><p className="mt-2 text-sm text-slate-300">Example: {phrase.exampleSentence}</p><p className="mt-2 text-sm text-slate-400">Why useful: {phrase.whyUseful}</p></article>)}</div>{notice && <p className="mt-3 text-sm text-amber-200">{notice}</p>}
    <h2 className="mt-10 text-2xl font-semibold">Difficult sentences</h2><div className="mt-4 space-y-4">{storedLesson.lesson.difficultSentences.map((sentence) => <article className="rounded-xl border border-slate-800 p-4" key={sentence.original}><p className="font-medium">Original: {sentence.original}</p><p className="mt-2">Simpler English: {sentence.simplifiedEnglish}</p><p className="mt-2 text-sm text-slate-400">Vocabulary: {sentence.importantVocabulary.join(", ")}</p><p className="mt-2 text-sm text-slate-300">{sentence.languageNote}</p></article>)}</div>
    <h2 className="mt-10 text-2xl font-semibold">Reading check</h2><div className="mt-4 space-y-5">{storedLesson.lesson.readingQuestions.map((question) => { const answer = answers[question.id]; const feedback = submitted[question.id] && answer ? gradeReadingQuestion(question, answer) : null; return <article className="rounded-xl border border-slate-800 p-4" key={question.id}><p className="font-medium">{question.question}</p><div className="mt-3 space-y-2">{question.options.map((option) => <label className="flex gap-2 text-sm" key={option.id}><input type="radio" name={question.id} checked={answer === option.id} onChange={() => setAnswers({ ...answers, [question.id]: option.id })} />{option.text}</label>)}</div><button className="mt-3 rounded bg-cyan-300 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={!answer} onClick={() => setSubmitted({ ...submitted, [question.id]: true })}>Check answer</button>{feedback && <p className={`mt-3 text-sm ${feedback.correct ? "text-emerald-300" : "text-amber-200"}`}>{feedback.correct ? "Correct." : "Try again."} {feedback.explanation}</p>}</article>; })}</div>
    <h2 className="mt-10 text-2xl font-semibold">Speaking</h2><article className="mt-4 rounded-xl border border-slate-800 p-4"><p>{storedLesson.lesson.speaking.mainTask}</p><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">{storedLesson.lesson.speaking.followUps.map((followUp) => <li key={followUp}>{followUp}</li>)}</ul><p className="mt-4 text-sm text-slate-400">ChatGPT Voice instruction: {storedLesson.lesson.speaking.chatGptVoiceInstruction}</p></article>
    <h2 className="mt-10 text-2xl font-semibold">Writing</h2><article className="mt-4 rounded-xl border border-slate-800 p-4"><p>{storedLesson.lesson.writing.task}</p><p className="mt-2 text-sm text-slate-400">Target: {storedLesson.lesson.writing.minWords}–{storedLesson.lesson.writing.maxWords} words. Feedback and error tracking begin in M3.</p></article>
  </section>;
}
