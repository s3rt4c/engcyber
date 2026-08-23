import { describe, expect, it } from "vitest";

import { retryTransientAiOperation } from "@/server/ai/retry";

describe("transient AI retry boundary", () => {
  it("returns the successful second attempt after one 503", async () => {
    const attempts: number[] = [];
    const delays: number[] = [];

    const result = await retryTransientAiOperation(
      async ({ attempt }) => {
        attempts.push(attempt);
        if (attempt === 1) throw { status: 503 };
        return "lesson";
      },
      { wait: async (milliseconds) => { delays.push(milliseconds); }, random: () => 0.5 },
    );

    expect(result).toEqual({ value: "lesson", attempt: 2 });
    expect(attempts).toEqual([1, 2]);
    expect(delays).toEqual([1_000]);
  });

  it("returns the successful third attempt after two 503 responses", async () => {
    const attempts: number[] = [];
    const delays: number[] = [];

    const result = await retryTransientAiOperation(
      async ({ attempt }) => {
        attempts.push(attempt);
        if (attempt < 3) throw { status: 503 };
        return "lesson";
      },
      { wait: async (milliseconds) => { delays.push(milliseconds); }, random: () => 0.5 },
    );

    expect(result).toEqual({ value: "lesson", attempt: 3 });
    expect(attempts).toEqual([1, 2, 3]);
    expect(delays).toEqual([1_000, 2_000]);
  });

  it("stops after three transient failures", async () => {
    let calls = 0;

    await expect(retryTransientAiOperation(
      async () => { calls += 1; throw { status: 503 }; },
      { wait: async () => undefined, random: () => 0.5 },
    )).rejects.toEqual({ status: 503 });

    expect(calls).toBe(3);
  });

  it("retries a 429 response", async () => {
    let calls = 0;

    const result = await retryTransientAiOperation(
      async () => {
        calls += 1;
        if (calls === 1) throw { status: 429 };
        return "lesson";
      },
      { wait: async () => undefined, random: () => 0.5 },
    );

    expect(result.attempt).toBe(2);
    expect(calls).toBe(2);
  });

  it("does not retry a 400 response", async () => {
    let calls = 0;

    await expect(retryTransientAiOperation(
      async () => { calls += 1; throw { status: 400 }; },
      { wait: async () => undefined, random: () => 0.5 },
    )).rejects.toEqual({ status: 400 });

    expect(calls).toBe(1);
  });
});
