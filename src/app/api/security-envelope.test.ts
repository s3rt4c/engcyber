import { describe, expect, it } from "vitest";

import { POST as actions } from "@/app/api/actions/route";
import { POST as contentFromText } from "@/app/api/content/from-text/route";
import { POST as contentFromUrl } from "@/app/api/content/from-url/route";
import { POST as ieltsReadingGenerate } from "@/app/api/ielts/reading/generate/route";
import { POST as ieltsReadingIdentity } from "@/app/api/ielts/reading/identity/route";
import { POST as ieltsWritingAnalyze } from "@/app/api/ielts/writing/analyze/route";
import { POST as lessonGenerate } from "@/app/api/lessons/generate/route";
import { POST as lessonIdentity } from "@/app/api/lessons/identity/route";
import { POST as reviewEvaluate } from "@/app/api/review/evaluate/route";
import { POST as writingAnalyze } from "@/app/api/writing/analyze/route";

const protectedPosts = [
  actions,
  contentFromText,
  contentFromUrl,
  lessonIdentity,
  lessonGenerate,
  reviewEvaluate,
  writingAnalyze,
  ieltsReadingIdentity,
  ieltsReadingGenerate,
  ieltsWritingAnalyze,
];

function crossSiteJsonRequest(): Request {
  return new Request("http://127.0.0.1:3000/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://cross-site.example", "sec-fetch-site": "cross-site" },
    body: "{}",
  });
}

function sameOriginInvalidJsonRequest(): Request {
  return new Request("http://127.0.0.1:3000/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1:3000", "sec-fetch-site": "same-origin" },
    body: "{}",
  });
}

describe("POST API security envelope", () => {
  it.each(protectedPosts)("rejects a cross-site JSON request before route work", async (handler) => {
    const response = await handler(crossSiteJsonRequest());
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "This request origin is not allowed." });
  });

  it.each(protectedPosts)("returns a safe client error for an invalid same-origin request", async (handler) => {
    const response = await handler(sameOriginInvalidJsonRequest());
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
