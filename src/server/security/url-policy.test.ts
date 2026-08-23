import { describe, expect, it } from "vitest";

import { assertPublicHttpUrl, fetchValidatedText } from "@/server/security/safe-fetch";

describe("external URL policy", () => {
  it.each(["ftp://example.com/file", "http://localhost/a", "http://127.0.0.1/a", "http://10.0.0.1/a", "http://100.64.0.1/a", "http://169.254.1.1/a", "http://[::1]/a", "http://[fe90::1]/a", "http://[ff02::1]/a", "http://[::ffff:172.16.0.1]/a", "http://user:pass@example.com/a"])
  ("rejects unsafe target %s", (target) => expect(() => assertPublicHttpUrl(target)).toThrow());

  it("revalidates a redirect target before following it", async () => {
    const fetcher = async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
    await expect(fetchValidatedText("https://example.com/article", { fetcher, lookup: async () => [{ address: "93.184.216.34", family: 4 }] })).rejects.toThrow("unsafe");
  });

  it("enforces the body cap even without a content-length header", async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(2_000_001))); controller.close(); } });
    const fetcher = async () => new Response(body, { status: 200, headers: { "content-type": "text/html" } });
    await expect(fetchValidatedText("https://example.com/article", { fetcher, lookup: async () => [{ address: "93.184.216.34", family: 4 }] })).rejects.toThrow("too large");
  });
});
