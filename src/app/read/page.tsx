import Link from "next/link";
import { ReadUrl } from "@/components/read-url";

export const dynamic = "force-dynamic";

export default async function ReadPage({ searchParams }: { searchParams: Promise<{ url?: string; title?: string; id?: string; source?: string; publishedAt?: string; category?: "cybersecurity_news" | "artificial_intelligence" | "my_content" }> }) {
  const params = await searchParams;
  if (!params.url) return <main className="min-h-screen bg-slate-950 p-10 text-slate-100">Choose an article from <Link className="text-cyan-300 underline" href="/">Discover</Link>.</main>;
  return <ReadUrl url={params.url} title={params.title ?? "Article"} id={params.id ?? "manual-url"} sourceName={params.source ?? "Manual URL"} publishedAt={params.publishedAt} category={params.category ?? "my_content"} />;
}
