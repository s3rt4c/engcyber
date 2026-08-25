import { describe, expect, it } from "vitest";

import { parseDarknetDiariesFeed } from "@/server/podcasts/feeds";

const feed = (items: string) => `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`;
const item = (values: { guid?: string; link: string; enclosure?: string; duration?: string; title?: string }) => `<item><title>${values.title ?? "178: Ubiquiti"}</title><guid>${values.guid ?? "prx_7057_episode"}</guid><link>${values.link}</link><pubDate>Tue, 04 Aug 2026 07:00:00 -0000</pubDate><description><![CDATA[<p>Official episode metadata.</p>]]></description>${values.enclosure ? `<enclosure url="${values.enclosure}" type="audio/mpeg"/>` : ""}${values.duration ? `<itunes:duration>${values.duration}</itunes:duration>` : ""}</item>`;

describe("Darknet Diaries RSS", () => {
  it("keeps only official numbered episode URLs and derives a stable GUID identity", () => {
    const xml = feed(`${item({ link: "https://darknetdiaries.com/episode/178/", enclosure: "https://cdn.example.test/audio.mp3", duration: "36:12" })}${item({ link: "https://darknetdiaries.com/low/", title: "LOW - Trailer" })}`);

    const first = parseDarknetDiariesFeed(xml);
    const second = parseDarknetDiariesFeed(xml);

    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ title: "178: Ubiquiti", durationSeconds: 2172, transcriptAvailability: "unknown", audioUrl: "https://cdn.example.test/audio.mp3" });
    expect(first[0]?.id).toBe(second[0]?.id);
  });

  it("rejects unsafe audio enclosures without hiding an otherwise usable episode", () => {
    const episodes = parseDarknetDiariesFeed(feed(item({ link: "https://darknetdiaries.com/episode/178/", enclosure: "javascript:alert(1)" })));
    expect(episodes[0]?.audioUrl).toBeNull();
  });

  it("uses the canonical official URL when a feed GUID exceeds the opaque metadata limit", () => {
    const withOverlongGuid = parseDarknetDiariesFeed(feed(item({ link: "https://darknetdiaries.com/episode/178/", guid: "x".repeat(301) })))[0];
    const withoutGuid = parseDarknetDiariesFeed(feed(item({ link: "https://darknetdiaries.com/episode/178/", guid: "" })))[0];

    expect(withOverlongGuid?.feedGuid).toBeNull();
    expect(withOverlongGuid?.id).toBe(withoutGuid?.id);
  });
});
