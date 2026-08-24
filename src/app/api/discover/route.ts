import { NextResponse } from "next/server";
import { discoverCuratedFeeds } from "@/server/discovery/feeds";

export async function GET() {
  try { return NextResponse.json(await discoverCuratedFeeds()); }
  catch { return NextResponse.json({ items: [], sources: [], error: "Discovery is temporarily unavailable. Try again shortly." }, { status: 502 }); }
}
