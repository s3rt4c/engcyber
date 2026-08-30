import { apiError, apiJson } from "@/server/api-response";
import { loadPodcastTranscript } from "@/server/podcasts/service";
import { withFetchAdmission } from "@/server/abuse-runtime";

export async function GET(request: Request, { params }: { params: Promise<{ episodeId: string }> }) {
  try {
    const { episodeId } = await params;
    const result = await withFetchAdmission(request, "application_fetch", async () => await loadPodcastTranscript(episodeId));
    if (result.status === "available") return apiJson(result);
    if (result.status === "unavailable") return apiJson(result, { status: 404 });
    return apiJson(result, { status: 422 });
  } catch (error) { return apiError(error, "Transcript retrieval is temporarily unavailable.", 502); }
}
