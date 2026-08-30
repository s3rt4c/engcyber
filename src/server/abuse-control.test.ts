import { describe, expect, it } from "vitest";

import { AbuseControlError, createAbuseController, createInMemoryAbuseStore } from "@/server/abuse-control";

describe("distributed abuse-control policy", () => {
  it("shares one burst-three AI budget across all AI route categories", async () => {
    const controls = createAbuseController({ store: createInMemoryAbuseStore(), now: () => 0, createLeaseId: () => "lease" });
    await controls.admit("subject-a", "ai");
    await controls.admit("subject-a", "ai");
    await controls.admit("subject-a", "ai");
    await expect(controls.admit("subject-a", "ai")).rejects.toEqual(new AbuseControlError(429, "Too many requests. Try again shortly.", 10));
  });

  it("refills the AI bucket deterministically after ten seconds", async () => {
    let now = 0;
    const controls = createAbuseController({ store: createInMemoryAbuseStore(), now: () => now, createLeaseId: () => "lease" });
    await Promise.all([controls.admit("subject-a", "ai"), controls.admit("subject-a", "ai"), controls.admit("subject-a", "ai")]);
    now = 10_000;
    await expect(controls.admit("subject-a", "ai")).resolves.toBeUndefined();
  });

  it("keeps manual URL import independent from AI quota", async () => {
    const controls = createAbuseController({ store: createInMemoryAbuseStore(), now: () => 0, createLeaseId: () => "lease" });
    await Promise.all([controls.admit("subject-a", "ai"), controls.admit("subject-a", "ai"), controls.admit("subject-a", "ai")]);
    await expect(controls.admit("subject-a", "manual_fetch")).resolves.toBeUndefined();
  });

  it("limits one subject to two active AI leases and releases idempotently", async () => {
    let number = 0;
    const controls = createAbuseController({ store: createInMemoryAbuseStore(), now: () => 0, createLeaseId: () => `lease-${++number}` });
    const first = await controls.acquireAiLease("subject-a");
    await controls.acquireAiLease("subject-a");
    await expect(controls.acquireAiLease("subject-a")).rejects.toEqual(new AbuseControlError(429, "Too many AI requests are already running. Try again shortly."));
    await controls.releaseAiLease(first);
    await controls.releaseAiLease(first);
    await expect(controls.acquireAiLease("subject-a")).resolves.toMatchObject({ subjectHash: expect.any(String) });
  });

  it("automatically ignores an orphaned 90-second lease and isolates another subject", async () => {
    let now = 0;
    let number = 0;
    const controls = createAbuseController({ store: createInMemoryAbuseStore(), now: () => now, createLeaseId: () => `lease-${++number}` });
    await controls.acquireAiLease("subject-a");
    await controls.acquireAiLease("subject-a");
    await expect(controls.acquireAiLease("subject-b")).resolves.toMatchObject({ subjectHash: expect.any(String) });
    now = 90_000;
    await expect(controls.acquireAiLease("subject-a")).resolves.toMatchObject({ subjectHash: expect.any(String) });
  });
});
