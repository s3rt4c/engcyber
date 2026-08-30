import { describe, expect, it, vi } from "vitest";

import { aiLeaseTtlMilliseconds, abusePolicies } from "@/server/abuse-control";
import { createUpstashAbuseStore } from "@/server/upstash-abuse-store";

describe("Upstash abuse store", () => {
  it("uses one atomic Redis script with Redis TIME for token consumption", async () => {
    const redis = { eval: vi.fn().mockResolvedValue([0, 10]), zrem: vi.fn() };
    const store = createUpstashAbuseStore(redis);
    await expect(store.consumeToken({ category: "ai", subjectHash: "opaque", policy: abusePolicies.ai, now: 0 })).resolves.toEqual({ allowed: false, retryAfterSeconds: 10 });
    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("TIME"), ["engcyber:m17:bucket:ai:opaque"], ["3", "6"]);
  });

  it("atomically acquires and releases an expiring subject lease", async () => {
    const redis = { eval: vi.fn().mockResolvedValue(1), zrem: vi.fn().mockResolvedValue(1) };
    const store = createUpstashAbuseStore(redis);
    const lease = { subjectHash: "opaque", leaseId: "lease-a", expiresAt: aiLeaseTtlMilliseconds };
    await expect(store.acquireAiLease(lease)).resolves.toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("ZREMRANGEBYSCORE"), ["engcyber:m17:ai-leases:opaque"], ["lease-a", String(aiLeaseTtlMilliseconds)]);
    await store.releaseAiLease(lease);
    expect(redis.zrem).toHaveBeenCalledWith("engcyber:m17:ai-leases:opaque", "lease-a");
  });
});
