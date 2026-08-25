"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserLessonStore } from "@/client/local-lesson-store";
import { LessonPanel } from "@/components/lesson-panel";
import type { StoredLesson } from "@/domain/lesson";
import { safeExternalHttpUrl } from "@/domain/safe-link";

export function SavedLessonDetail({ lessonId }: { readonly lessonId: string }) {
  const [lesson, setLesson] = useState<StoredLesson | null | undefined>(undefined);
  useEffect(() => { let active = true; void createBrowserLessonStore().list().then((lessons) => { if (active) setLesson(lessons.find((entry) => entry.id === lessonId) ?? null); }); return () => { active = false; }; }, [lessonId]);
  if (lesson === undefined) return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><p className="mx-auto max-w-3xl text-slate-400">Loading saved lesson from this browser…</p></main>;
  if (lesson === null) return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-3xl"><h1 className="text-3xl font-semibold">Saved lesson unavailable</h1><p className="mt-3 text-slate-300">This lesson is not available in this browser.</p><Link className="mt-5 inline-flex text-cyan-200 underline" href="/library">Back to Library</Link></div></main>;
  const sourceUrl = safeExternalHttpUrl(lesson.context?.canonicalUrl);
  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-3xl"><Link className="text-sm text-cyan-200 underline" href="/library">Back to Library</Link><p className="mt-8 text-sm uppercase tracking-wide text-cyan-300">Saved lesson</p><h1 className="mt-2 text-3xl font-semibold">{lesson.context?.title ?? "Saved lesson"}</h1>{lesson.context?.sourceLabel && <p className="mt-2 text-sm text-slate-400">{lesson.context.sourceLabel}</p>}{sourceUrl && <a className="mt-3 inline-block text-sm text-cyan-200 underline" href={sourceUrl} target="_blank" rel="noreferrer">Open original source</a>}{!lesson.context && <p className="mt-4 text-sm text-amber-200">Source context unavailable for this older saved lesson.</p>}</div><LessonPanel storedLesson={lesson} /></main>;
}
