import { apiError, apiJson } from "@/server/api-response";
import { listPodcasts } from "@/server/podcasts/service";
import { withFetchAdmission } from "@/server/abuse-runtime";

export async function GET(request: Request) {
  try { return apiJson(await withFetchAdmission(request, "application_fetch", async () => await listPodcasts())); }
  catch (error) { return apiError(error, "Podcast discovery is temporarily unavailable.", 502); }
}
