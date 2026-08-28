import { describe, expect, it } from "vitest";

import { openAiClientOptions } from "@/server/ai/provider-request";

describe("provider request options", () => {
  it("sets one bounded OpenAI attempt and leaves retry ownership to EngCyber", () => {
    expect(openAiClientOptions("synthetic-key")).toEqual({ apiKey: "synthetic-key", timeout: 20_000, maxRetries: 0 });
  });
});
