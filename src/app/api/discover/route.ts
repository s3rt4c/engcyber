import { apiError, apiJson } from "@/server/api-response";
import { discoverCuratedFeeds } from "@/server/discovery/feeds";
import { withFetchAdmission } from "@/server/abuse-runtime";

export async function GET(request: Request) {
  try { return apiJson(await withFetchAdmission(request, "application_fetch", async () => await discoverCuratedFeeds())); }
  catch (error) { return apiError(error, "Discovery is temporarily unavailable. Try again shortly.", 502); }
}
