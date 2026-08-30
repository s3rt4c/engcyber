import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ACCESS_SUBJECT_HEADER } from "@/server/access-control";
import { config, proxy } from "../proxy";

const originalEnvironment = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnvironment };
});

describe("M17 request proxy", () => {
  it.each(["/", "/discover", "/library", "/ielts", "/backup", "/read", "/api/actions", "/api/podcasts/1/transcript"])("matches the protected route %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
  });

  it.each(["/_next/static/chunk.js", "/_next/image?url=%2Ficon.png", "/favicon.ico", "/robots.txt", "/sitemap.xml"])("intentionally excludes the non-application asset %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false);
  });

  it("rejects a direct protected API request without an Access JWT even with a forged subject and valid Origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENGCYBER_ACCESS_MODE", "cloudflare");
    vi.stubEnv("CLOUDFLARE_ACCESS_TEAM_DOMAIN", "engcyber.cloudflareaccess.com");
    vi.stubEnv("CLOUDFLARE_ACCESS_AUD", "private-engcyber");
    const response = await proxy(new NextRequest("https://origin.vercel.app/api/lessons/generate", {
      method: "POST",
      headers: { origin: "https://engcyber.example.com", [ACCESS_SUBJECT_HEADER]: "forged-subject" },
    }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Access is required." });
  });

  it("does not expose a client-supplied internal subject in local mode", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const response = await proxy(new NextRequest("http://localhost:3000/api/actions", {
      headers: { [ACCESS_SUBJECT_HEADER]: "forged-subject" },
    }));
    expect(response.headers.get(ACCESS_SUBJECT_HEADER)).toBeNull();
  });
});
