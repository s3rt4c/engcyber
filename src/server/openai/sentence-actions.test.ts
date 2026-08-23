import { describe, expect, it } from "vitest";

import { openAiActionConfiguration } from "@/server/openai/sentence-actions";

describe("OpenAI sentence actions", () => {
  it("remain opt-in when no server-side model configuration exists", () => {
    expect(openAiActionConfiguration({})).toBeNull();
  });

  it("requires both an API key and an explicit model", () => {
    expect(openAiActionConfiguration({ OPENAI_API_KEY: "key" })).toBeNull();
    expect(openAiActionConfiguration({ OPENAI_API_KEY: "key", OPENAI_MODEL: "gpt-5-mini" })).toEqual({ apiKey: "key", model: "gpt-5-mini" });
  });
});
