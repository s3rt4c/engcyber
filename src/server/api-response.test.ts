import { describe, expect, it } from "vitest";

import { apiError, apiJson } from "@/server/api-response";
import { RequestSecurityError } from "@/server/request-security";

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
});
