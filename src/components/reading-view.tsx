"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserLessonStore } from "@/client/local-lesson-store";
import { createBrowserPhraseStore } from "@/client/local-phrase-store";
import { openCachedOrGeneratedLesson } from "@/client/lesson-flow";
import { LessonPanel } from "@/components/lesson-panel";
import { createStoredLessonContext, type StoredLesson } from "@/domain/lesson";
import { ieltsReadingSourceProblem } from "@/domain/ielts";
import { buildLessonSource } from "@/domain/lesson";
import { openCachedOrGeneratedIeltsReading } from "@/client/ielts-reading-flow";
import { createBrowserIeltsPracticeStore } from "@/client/local-ielts-practice-store";
import type { Content } from "@/domain/models";
import type { SentenceAction } from "@/domain/sentence-actions";

function selectionContext(selection: Selection, fallback: string): string {
  const node = selection.anchorNode;
  const element = node instanceof Element ? node : node?.parentElement;
  return (element?.closest("p,li,h1,h2,h3,h4")?.textContent ?? fallback).replace(/\s+/g, " ").trim().slice(0, 600);
}

export function ReadingView({ content, sourceName }: { content: Content; sourceName?: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [notice, setNotice] = useState("");
  const [lesson, setLesson] = useState<StoredLesson | null>(null);
  const [lessonBusy, setLessonBusy] = useState(false);
  const [showLesson, setShowLesson] = useState(false);
  const [ieltsBusy, setIeltsBusy] = useState(false);
  const paragraphs = useMemo(() => content.sanitizedText.split(/\n{2,}/).filter(Boolean), [content.sanitizedText]);
  const capture = () => { const selection = window.getSelection(); const text = selection?.toString().trim() ?? ""; if (selection && text) { setSelected(text.slice(0, 2_000)); setContext(selectionContext(selection, text)); setResult(""); setNotice(""); } };
  const speak = () => { if (!selected) return; if (!("speechSynthesis" in window)) return setNotice("Browser speech is unavailable."); window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(selected); utterance.lang = "en-US"; utterance.rate = 0.9; window.speechSynthesis.speak(utterance); };
  const act = async (action: SentenceAction) => { if (!selected) return setNotice("Select English text first."); setNotice("Working…"); try { const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, selectedText: selected, surroundingContext: context }) }); const data = await response.json() as { result?: string; error?: string }; setResult(data.result ?? ""); setNotice(data.error ?? ""); } catch { setNotice("AI support is temporarily unavailable."); } };
  const save = async () => { if (!selected) return setNotice("Select a phrase first."); const outcome = await createBrowserPhraseStore().save({ phrase: selected, context: context || selected, sourceTitle: sourceName ?? content.title, sourceUrl: content.canonicalUrl, contentId: content.id, savedAt: new Date().toISOString() }); setNotice(outcome === "saved" ? "Phrase saved on this browser." : outcome === "duplicate" ? "That phrase is already saved for this context." : "Browser storage is unavailable; the phrase was not saved."); };
  const createLesson = async () => {
    setLessonBusy(true); setNotice("");
    try {
      const identityResponse = await fetch("/api/lessons/identity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      const identity = await identityResponse.json() as { generationFingerprint?: string; error?: string };
      if (!identityResponse.ok || !identity.generationFingerprint) throw new Error(identity.error ?? "Lesson identity failed.");
      const opened = await openCachedOrGeneratedLesson({ generationFingerprint: identity.generationFingerprint, store: createBrowserLessonStore(), generate: async () => {
        const response = await fetch("/api/lessons/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
        const data = await response.json() as { lesson?: StoredLesson; error?: string };
        if (!response.ok || !data.lesson) throw new Error(data.error ?? "Lesson generation failed.");
        return { ...data.lesson, context: createStoredLessonContext(content, sourceName) };
      } });
      setLesson(opened.lesson); setShowLesson(true); if (opened.cacheHit) setNotice("Opened your cached lesson without an AI request.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Lesson generation failed."); } finally { setLessonBusy(false); }
  };
  const createIeltsPractice = async () => {
    const sourceProblem = ieltsReadingSourceProblem(buildLessonSource(content.title, content.sanitizedText).text);
    if (sourceProblem) return setNotice(sourceProblem);
    setIeltsBusy(true); setNotice("");
    try {
      const identityResponse = await fetch("/api/ielts/reading/identity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      const identity = await identityResponse.json() as { generationFingerprint?: string; error?: string };
      if (!identityResponse.ok || !identity.generationFingerprint) throw new Error(identity.error ?? "IELTS Reading identity failed.");
      const opened = await openCachedOrGeneratedIeltsReading({ generationFingerprint: identity.generationFingerprint, store: createBrowserIeltsPracticeStore(), generate: async () => {
        const response = await fetch("/api/ielts/reading/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
        const data = await response.json() as { questions?: unknown; generationFingerprint?: string; source?: { id: string; fingerprint: string; title: string; url: string | null }; error?: string };
        if (!response.ok || !Array.isArray(data.questions) || !data.generationFingerprint || !data.source) throw new Error(data.error ?? "IELTS Reading generation failed.");
        const now = new Date().toISOString();
        return { id: globalThis.crypto?.randomUUID?.() ?? `ielts-reading-${Date.now()}`, generationFingerprint: data.generationFingerprint, sourceId: data.source.id, sourceFingerprint: data.source.fingerprint, sourceTitle: data.source.title, sourceUrl: data.source.url, questions: data.questions as never, answers: {}, completedAt: null, elapsedSeconds: null, createdAt: now, updatedAt: now };
      } });
      setNotice(opened.cacheHit ? "Opened your cached IELTS-style Reading practice without an AI request." : "IELTS-style Reading practice created.");
      router.push(`/ielts/reading/${opened.practice.id}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "IELTS Reading generation failed."); } finally { setIeltsBusy(false); }
  };
  const attribution = [sourceName, content.author, content.publishedAt ? content.publishedAt.toLocaleDateString() : null].filter(Boolean).join(" · ");
  return <><article className="mx-auto max-w-3xl px-6 py-10" tabIndex={0} onMouseUp={capture} onTouchEnd={capture} onKeyUp={capture}><Link className="text-sm text-cyan-300" href="/">← Discover</Link><p className="mt-8 text-sm text-cyan-300">{content.primaryCategory.replaceAll("_", " ")}</p><h1 className="mt-2 text-3xl font-semibold">{content.title}</h1><p className="mt-3 text-sm text-slate-400">{attribution || "Publisher attribution unavailable"}</p>{content.canonicalUrl && <a className="mt-3 inline-block text-sm text-cyan-300 underline" href={content.canonicalUrl} target="_blank" rel="noreferrer">Open original article</a>}<div className="mt-6 flex flex-wrap gap-3"><button className="rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={lessonBusy} onClick={lesson ? () => setShowLesson(true) : createLesson}>{lessonBusy ? "Creating lesson…" : lesson ? "Open Lesson" : "Create Lesson"}</button><button className="rounded border border-cyan-300 px-4 py-2 text-sm text-cyan-100 disabled:opacity-50" disabled={ieltsBusy} onClick={() => void createIeltsPractice()}>{ieltsBusy ? "Creating IELTS practice…" : "Create IELTS-style Reading Practice"}</button>{lesson && <button className="rounded border border-slate-600 px-4 py-2 text-sm" onClick={() => setShowLesson(false)}>Read Article</button>}</div>{notice && <p className="mt-3 text-sm text-amber-200">{notice}</p>}<div className="mt-10 space-y-5 text-lg leading-8 text-slate-200">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{selected && <aside className="sticky bottom-4 mt-8 rounded-xl border border-cyan-400/40 bg-slate-900 p-4 shadow-xl"><p className="text-sm text-slate-300">Selected: “{selected}”</p><div className="mt-3 flex flex-wrap gap-2">{(["simplify", "explain", "translate"] as const).map((action) => <button className="rounded bg-cyan-300 px-3 py-2 text-sm font-medium text-slate-950" key={action} onClick={() => act(action)}>{action}</button>)}<button className="rounded border border-slate-600 px-3 py-2 text-sm" onClick={speak}>Listen</button><button className="rounded border border-slate-600 px-3 py-2 text-sm" onClick={save}>Save Phrase</button><button className="rounded border border-slate-600 px-3 py-2 text-sm" onClick={() => window.speechSynthesis?.cancel()}>Stop</button></div>{notice && <p className="mt-3 text-sm text-amber-200">{notice}</p>}{result && <div className="mt-3 rounded bg-slate-800 p-3 text-sm leading-6"><strong>Support:</strong> {result}</div>}</aside>}</article>{showLesson && lesson && <LessonPanel storedLesson={lesson} content={content} />}</>;
}
