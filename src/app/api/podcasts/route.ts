import { NextResponse } from "next/server";
import { listPodcasts } from "@/server/podcasts/service";

export async function GET() {
  try { return NextResponse.json(await listPodcasts()); }
  catch { return NextResponse.json({ episodes: [], error: "Podcast discovery is temporarily unavailable." }, { status: 502 }); }
}
