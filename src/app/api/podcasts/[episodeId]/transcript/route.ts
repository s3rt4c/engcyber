import { NextResponse } from "next/server";
import { loadPodcastTranscript } from "@/server/podcasts/service";

export async function GET(_: Request, { params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params;
  const result = await loadPodcastTranscript(episodeId);
  if (result.status === "available") return NextResponse.json(result);
  if (result.status === "unavailable") return NextResponse.json(result, { status: 404 });
  return NextResponse.json(result, { status: 422 });
}
