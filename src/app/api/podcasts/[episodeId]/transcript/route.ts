import { apiError, apiJson } from "@/server/api-response";
import { loadPodcastTranscript } from "@/server/podcasts/service";

export async function GET(_: Request, { params }: { params: Promise<{ episodeId: string }> }) {
  try {
    const { episodeId } = await params;
    const result = await loadPodcastTranscript(episodeId);
    if (result.status === "available") return apiJson(result);
    if (result.status === "unavailable") return apiJson(result, { status: 404 });
    return apiJson(result, { status: 422 });
  } catch (error) { return apiError(error, "Transcript retrieval is temporarily unavailable.", 502); }
}
