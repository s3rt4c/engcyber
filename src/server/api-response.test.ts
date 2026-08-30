import { describe, expect, it } from "vitest";

import { apiError, apiJson } from "@/server/api-response";
import { RequestSecurityError } from "@/server/request-security";
import { AbuseControlError } from "@/server/abuse-control";

describe("API response envelope", () => {
  it("marks dynamic API success responses as no-store", async () => {
    const response = apiJson({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns stable security failures without unknown exception text", async () => {
    const response = apiError(new Error("synthetic-provider-internal-detail"));
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.not.toContain("synthetic-provider-internal-detail");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("preserves typed public request-security failures", async () => {
    const response = apiError(new RequestSecurityError(413, "Request is too large."));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Request is too large." });
  });

  it("returns a bounded truthful retry header for token-bucket saturation", async () => {
    const response = apiError(new AbuseControlError(429, "Too many requests. Try again shortly.", 10));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("10");
    await expect(response.json()).resolves.toEqual({ error: "Too many requests. Try again shortly." });
  });
});
