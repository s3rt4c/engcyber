import { afterEach, describe, expect, it, vi } from "vitest";

const providerRun = vi.hoisted(() => vi.fn(async () => "unexpected"));
const upstreamFetch = vi.hoisted(() => vi.fn(async () => ({ url: "https://example.com/article", html: "<article>unexpected</article>" })));

vi.mock("@/server/ai/runtime", () => ({
  resolveAiRuntime: () => ({ id: "gemini", actionModel: "test", lessonModel: "test", runSentenceAction: providerRun, generateLesson: async () => { throw new Error("not called"); }, analyzeWriting: async () => { throw new Error("not called"); }, evaluateReview: async () => { throw new Error("not called"); }, generateIeltsReading: async () => { throw new Error("not called"); }, analyzeIeltsWriting: async () => { throw new Error("not called"); } }),
}));
vi.mock("@/server/security/safe-fetch", () => ({ fetchValidatedText: upstreamFetch }));

import { POST as actions } from "@/app/api/actions/route";
import { POST as contentFromUrl } from "@/app/api/content/from-url/route";

const originalEnvironment = { ...process.env };

function privateEnvironment() {
  process.env = {
    ...originalEnvironment,
    NODE_ENV: "production",
    ENGCYBER_APP_ORIGIN: "https://engcyber.example.com",
    ENGCYBER_ACCESS_MODE: "cloudflare",
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: "engcyber.cloudflareaccess.com",
    CLOUDFLARE_ACCESS_AUD: "private-engcyber",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
  };
}

function protectedPost(path: string, body: unknown) {
  return new Request(`https://engcyber.example.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://engcyber.example.com", "sec-fetch-site": "same-origin", "x-engcyber-access-subject": "verified-subject" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  process.env = { ...originalEnvironment };
  providerRun.mockClear();
  upstreamFetch.mockClear();
});

describe("M17 route admission", () => {
  it("returns 503 before an AI provider call when Redis is unavailable", async () => {
    privateEnvironment();
    const response = await actions(protectedPost("/api/actions", { action: "simplify", selectedText: "A selected sentence.", surroundingContext: "Context." }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Request controls are temporarily unavailable." });
    expect(providerRun).not.toHaveBeenCalled();
  });

  it("returns 503 before manual URL fetch work when Redis is unavailable", async () => {
    privateEnvironment();
    const response = await contentFromUrl(protectedPost("/api/content/from-url", { url: "https://example.com/article" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Request controls are temporarily unavailable." });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });
});
