"use client";

import { useEffect, useMemo, useState } from "react";

import { filterDiscoverItems, type DiscoverFilters, type DiscoverResult, type DiscoverSourceHealth } from "@/domain/discovery";
import { contentCategories } from "@/domain/learning";
import type { FeedItem } from "@/domain/models";

type SerializedFeedItem = Omit<FeedItem, "publishedAt"> & { publishedAt: string | null };
type SerializedDiscoverResult = Omit<DiscoverResult, "items"> & { items: SerializedFeedItem[]; error?: string };

function readUrl(item: FeedItem): string {
  const query = new URLSearchParams({ url: item.canonicalUrl ?? "", title: item.title, id: item.id, source: item.sourceName, publishedAt: item.publishedAt?.toISOString() ?? "", category: item.primaryCategory });
  return `/read?${query.toString()}`;
}

function SourceHealth({ sources }: { sources: readonly DiscoverSourceHealth[] }) {
  if (!sources.length) return null;
  return <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400" aria-label="Source status">{sources.map((source) => <li key={source.sourceId}><span className={source.state === "available" ? "text-emerald-300" : "text-amber-300"}>{source.state === "available" ? "Available" : "Temporarily unavailable"}</span> · {source.sourceName}</li>)}</ul>;
}

export function DiscoverScreen() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [sources, setSources] = useState<readonly DiscoverSourceHealth[]>([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<DiscoverFilters>({ category: "all", sourceId: "all", sort: "newest" });

  useEffect(() => {
    fetch("/api/discover")
      .then(async (response) => {
        const data = await response.json() as SerializedDiscoverResult;
        if (!response.ok) throw new Error(data.error ?? "Discovery is temporarily unavailable.");
        setItems(data.items.map((item) => ({ ...item, publishedAt: item.publishedAt ? new Date(item.publishedAt) : null })));
        setSources(data.sources);
        setError(data.error ?? "");
      })
      .catch(() => setError("Discovery is temporarily unavailable. Try again shortly."));
  }, []);

  const visibleItems = useMemo(() => filterDiscoverItems(items, filters), [items, filters]);

  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-6"><div><p className="text-sm font-semibold tracking-[0.2em] text-cyan-300 uppercase">EngCyber</p><h1 className="mt-2 text-3xl font-semibold">Discover authentic English</h1></div><a className="rounded border border-cyan-300 px-4 py-2 text-sm text-cyan-200" href="/add-content">Add Content</a></header>
    <p className="mt-8 max-w-2xl text-slate-300">Curated cybersecurity and AI metadata is fetched without generating lessons or calling AI. Open an item to import readable article text safely.</p>
    <section className="mt-8"><h2 className="text-xl font-semibold">Curated sources</h2>{error && <p className="mt-3 rounded bg-amber-950 p-3 text-amber-100">{error}</p>}<SourceHealth sources={sources} />
      <div className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-3"><label className="text-sm text-slate-300">Category<select className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value as DiscoverFilters["category"] }))}><option value="all">All categories</option>{contentCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-sm text-slate-300">Source<select className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100" value={filters.sourceId} onChange={(event) => setFilters((current) => ({ ...current, sourceId: event.target.value }))}><option value="all">All sources</option>{sources.map((source) => <option key={source.sourceId} value={source.sourceId}>{source.sourceName}</option>)}</select></label><label className="text-sm text-slate-300">Sort<select className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100" value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as DiscoverFilters["sort"] }))}><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label></div>
      {!error && !sources.length && <p className="mt-3 text-slate-400">Loading current feed metadata…</p>}
      {!error && sources.length > 0 && !visibleItems.length && <p className="mt-4 text-slate-400">No available items match these filters.</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">{visibleItems.map((item) => <article className="rounded-xl border border-slate-800 bg-slate-900 p-5" key={item.id}><p className="text-xs uppercase tracking-wide text-cyan-300">{item.primaryCategory.replaceAll("_", " ")} · {item.contentType}</p><p className="mt-2 text-sm text-slate-400">{item.sourceName}</p><h3 className="mt-2 text-lg font-medium">{item.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{item.summary ?? "No feed summary provided."}</p><p className="mt-3 text-xs text-slate-500">{item.publishedAt ? item.publishedAt.toLocaleDateString() : "Date unavailable"}</p>{item.canonicalUrl && <div className="mt-4 flex flex-wrap gap-4 text-sm"><a className="text-cyan-300 underline" href={readUrl(item)}>Read article</a><a className="text-cyan-300 underline" href={item.canonicalUrl} target="_blank" rel="noreferrer">Original source</a></div>}</article>)}</div>
    </section>
    <section className="mt-12"><h2 className="text-xl font-semibold">Categories</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{contentCategories.map((category) => <div className="rounded border border-slate-800 p-4" key={category.id}><strong>{category.name}</strong><p className="mt-2 text-sm text-slate-400">{["cybersecurity_news", "artificial_intelligence"].includes(category.id) ? "Curated feed metadata" : "Coming later"}</p></div>)}</div></section>
  </div></main>;
}
