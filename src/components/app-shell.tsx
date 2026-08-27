"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export const primaryNavigation = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/library", label: "Library" },
  { href: "/ielts", label: "IELTS Practice" },
  { href: "/review", label: "Review" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/listening", label: "Listening" },
  { href: "/podcasts", label: "Podcasts" },
  { href: "/progress", label: "Progress" },
] as const;

function activeRoute(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  return <><header className="border-b border-slate-800 bg-slate-950/95"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4"><Link className="font-semibold tracking-wide text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" href="/">EngCyber</Link><nav aria-label="Primary navigation" className="flex max-w-full flex-wrap gap-x-4 gap-y-2 text-sm"><Link className="rounded px-2 py-1 text-cyan-200 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href="/add-content">Add Content</Link>{primaryNavigation.map((item) => <Link className={`rounded px-2 py-1 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${activeRoute(pathname, item.href) ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:text-cyan-200"}`} href={item.href} key={item.href} aria-current={activeRoute(pathname, item.href) ? "page" : undefined}>{item.label}</Link>)}</nav></div></header>{children}</>;
}
