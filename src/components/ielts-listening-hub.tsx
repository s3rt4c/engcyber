"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createOrResumeIeltsListeningSession } from "@/client/ielts-listening-flow";
import { createBrowserIeltsPracticeStore } from "@/client/local-ielts-practice-store";
import { ieltsListeningPracticeBank } from "@/domain/ielts-listening-bank";
import type { IeltsListeningSession } from "@/domain/ielts-listening";

function identifier() { return globalThis.crypto?.randomUUID?.() ?? `ielts-listening-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function IeltsListeningHub() {
  const router = useRouter();
  const [sessions, setSessions] = useState<IeltsListeningSession[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => { let active = true; void createBrowserIeltsPracticeStore().listListening().then((saved) => { if (active) setSessions([...saved]); }); return () => { active = false; }; }, []);
  const start = async (definitionId: string) => {
    const definition = ieltsListeningPracticeBank.find((entry) => entry.id === definitionId);
    if (!definition) return;
    const store = createBrowserIeltsPracticeStore();
    const current = await store.listListening();
    const opened = createOrResumeIeltsListeningSession({ sessions: current, definition, now: new Date().toISOString(), createId: identifier });
    if (!await store.saveListening(opened.session)) { setNotice("Browser storage is unavailable."); return; }
    router.push(`/ielts/listening/${opened.session.id}`);
  };
  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-4xl"><Link className="text-sm text-cyan-300" href="/ielts">← IELTS Practice</Link><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">IELTS-oriented Listening</p><h1 className="mt-2 text-3xl font-semibold">Listening mini-practices</h1><p className="mt-3 max-w-3xl leading-7 text-slate-300">Eight application-owned learning practices with browser-synthesized audio. They are IELTS-oriented practice, not official IELTS recordings or assessment.</p>{notice && <p role="status" className="mt-4 rounded border border-amber-400/30 bg-amber-950/30 p-3 text-sm text-amber-100">{notice}</p>}
    <section className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Listening practice bank">{ieltsListeningPracticeBank.map((definition) => { const unfinished = sessions.find((session) => session.practiceDefinitionId === definition.id && session.completedAt === null); const completed = sessions.filter((session) => session.practiceDefinitionId === definition.id && session.completedAt !== null).length; return <article className="rounded-xl border border-slate-800 bg-slate-900 p-5" key={definition.id}><p className="text-sm capitalize text-cyan-300">{definition.partStyle.replaceAll("_", " ")}</p><h2 className="mt-2 text-xl font-semibold">{definition.title}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{definition.setting}</p><p className="mt-3 text-sm text-slate-400">6 questions · replay allowed{completed ? ` · ${completed} completed attempt${completed === 1 ? "" : "s"}` : ""}</p><button className="mt-4 rounded bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" onClick={() => void start(definition.id)}>{unfinished ? "Continue practice" : completed ? "Start new practice" : "Start practice"}</button></article>; })}</section>
  </div></main>;
}
