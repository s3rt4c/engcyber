import { apiError, apiJson } from "@/server/api-response";
import { listPodcasts } from "@/server/podcasts/service";

export async function GET() {
  try { return apiJson(await listPodcasts()); }
  catch (error) { return apiError(error, "Podcast discovery is temporarily unavailable.", 502); }
}
