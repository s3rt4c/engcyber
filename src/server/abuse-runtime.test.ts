import { describe, expect, it, vi } from "vitest";

import { AbuseControlError } from "@/server/abuse-control";
import { withAiAdmission, withFetchAdmission } from "@/server/abuse-runtime";

const privateEnvironment = {
  NODE_ENV: "production",
  ENGCYBER_ACCESS_MODE: "cloudflare",
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: "engcyber.cloudflareaccess.com",
  CLOUDFLARE_ACCESS_AUD: "private-engcyber",
};

describe("production abuse-control failure boundary", () => {
  it("fails closed before provider work when Upstash configuration is unavailable", async () => {
    const provider = vi.fn(async () => "unexpected");
    const request = new Request("https://origin.vercel.app/api/lessons/generate", { headers: { "x-engcyber-access-subject": "verified-subject" } });
    await expect(withAiAdmission(request, provider, privateEnvironment)).rejects.toEqual(new AbuseControlError(503, "Request controls are temporarily unavailable."));
    expect(provider).not.toHaveBeenCalled();
  });

  it("fails closed before a manual upstream fetch when Upstash configuration is unavailable", async () => {
    const upstreamFetch = vi.fn(async () => "unexpected");
    const request = new Request("https://origin.vercel.app/api/content/from-url", { headers: { "x-engcyber-access-subject": "verified-subject" } });
    await expect(withFetchAdmission(request, "manual_fetch", upstreamFetch, privateEnvironment)).rejects.toEqual(new AbuseControlError(503, "Request controls are temporarily unavailable."));
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("fails closed before an application-controlled upstream fetch when Upstash configuration is unavailable", async () => {
    const upstreamFetch = vi.fn(async () => "unexpected");
    const request = new Request("https://origin.vercel.app/api/discover", { headers: { "x-engcyber-access-subject": "verified-subject" } });
    await expect(withFetchAdmission(request, "application_fetch", upstreamFetch, privateEnvironment)).rejects.toEqual(new AbuseControlError(503, "Request controls are temporarily unavailable."));
    expect(upstreamFetch).not.toHaveBeenCalled();
  });
});
