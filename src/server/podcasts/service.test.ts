import { describe, expect, it } from "vitest";

import { listPodcasts, loadPodcastTranscript } from "@/server/podcasts/service";
import { darknetDiariesPodcastSource } from "@/server/podcasts/source-registry";

const episodeFeed = `<?xml version="1.0"?><rss><channel><item><title>178: Ubiquiti</title><guid>prx_178</guid><link>https://darknetdiaries.com/episode/178/</link><description>Episode metadata</description></item></channel></rss>`;
const lookup = async () => [{ address: "93.184.216.34", family: 4 }];

describe("podcast service", () => {
  it("uses only the RSS feed while listing episodes", async () => {
    const requests: string[] = [];
    const episodes = await listPodcasts({
      lookup,
      fetcher: async (input) => {
        requests.push(input.toString());
        return new Response(episodeFeed, { status: 200, headers: { "content-type": "application/rss+xml" } });
      },
    });

    expect(episodes.episodes).toHaveLength(1);
    expect(requests).toEqual([darknetDiariesPodcastSource.feedUrl]);
  });

  it("keeps a transient episode-page failure distinct from permanent transcript unavailability", async () => {
    const fetcher = async (input: URL | RequestInfo) => {
      if (input.toString() === darknetDiariesPodcastSource.feedUrl) return new Response(episodeFeed, { status: 200, headers: { "content-type": "application/rss+xml" } });
      throw new TypeError("network temporarily unavailable");
    };
    const { episodes } = await listPodcasts({ fetcher, lookup });
    const result = await loadPodcastTranscript(episodes[0]!.id, { fetcher, lookup });

    expect(result.status).toBe("failed");
    expect(result.episode?.transcriptAvailability).toBe("unknown");
  });

  it("reports a safety-limit rejection without treating it as permanent unavailability", async () => {
    const fetcher = async (input: URL | RequestInfo) => {
      if (input.toString() === darknetDiariesPodcastSource.feedUrl) return new Response(episodeFeed, { status: 200, headers: { "content-type": "application/rss+xml" } });
      return new Response("", { status: 200, headers: { "content-type": "text/html", "content-length": "524289" } });
    };
    const { episodes } = await listPodcasts({ fetcher, lookup });
    const result = await loadPodcastTranscript(episodes[0]!.id, { fetcher, lookup });

    expect(result.status).toBe("rejected");
    expect(result.episode?.transcriptAvailability).toBe("unknown");
  });
});
