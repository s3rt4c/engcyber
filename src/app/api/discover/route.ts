import { apiError, apiJson } from "@/server/api-response";
import { discoverCuratedFeeds } from "@/server/discovery/feeds";

export async function GET() {
  try { return apiJson(await discoverCuratedFeeds()); }
  catch (error) { return apiError(error, "Discovery is temporarily unavailable. Try again shortly.", 502); }
}
