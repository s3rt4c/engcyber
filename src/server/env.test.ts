import { describe, expect, it } from "vitest";

import { readServerEnvironment } from "@/server/env";

describe("readServerEnvironment", () => {
  it("requires server integration settings", () => {
    expect(() => readServerEnvironment({})).toThrow(
      "Missing required environment variable: SUPABASE_URL",
    );
  });

  it("returns the server integration settings when required values are provided", () => {
    expect(
      readServerEnvironment({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
        OPENAI_API_KEY: "server-key",
      }),
    ).toEqual({
      supabaseUrl: "https://project.supabase.co",
      supabaseAnonKey: "anon-key",
      openAiApiKey: "server-key",
    });
  });
});
