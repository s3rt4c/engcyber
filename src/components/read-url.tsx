"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Content } from "@/domain/models";
import { ReadingView } from "@/components/reading-view";
type SerializedContent = Omit<Content, "publishedAt"> & { publishedAt: string | null };

export function ReadUrl({ url, title, id, sourceName, publishedAt, category }: { url: string; title: string; id: string; sourceName: string; publishedAt?: string; category: "cybersecurity_news" | "artificial_intelligence" | "my_content" }) {
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/content/from-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, title, sourceId: id, publishedAt, category }) })
      .then(async (response) => { const data = await response.json() as { content?: SerializedContent; error?: string }; setContent(data.content ? { ...data.content, publishedAt: data.content.publishedAt ? new Date(data.content.publishedAt) : null } : null); setError(data.error ?? ""); })
      .catch(() => setError("Article import failed."));
  }, [url, title, id, publishedAt, category]);
  if (content) return <ReadingView content={content} sourceName={sourceName} />;
  return <main className="min-h-screen bg-slate-950 p-10 text-slate-100"><Link className="text-cyan-300" href="/">← Discover</Link><p className="mt-8">{error || "Importing a readable article…"}</p>{error && <a className="mt-4 inline-block text-cyan-300 underline" href={url} target="_blank" rel="noreferrer">Open original article</a>}</main>;
}
