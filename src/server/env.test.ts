import { describe, expect, it } from "vitest";

import { readServerEnvironment } from "@/server/env";

describe("readServerEnvironment", () => {
  it("requires server integration settings", () => {
    expect(() => readServerEnvironment({})).toThrow(
      "Missing required environment variable: SUPABASE_URL",
    );
  });

  it("returns Supabase settings without requiring an inactive AI provider's credentials", () => {
    expect(
      readServerEnvironment({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toEqual({
      supabaseUrl: "https://project.supabase.co",
      supabaseAnonKey: "anon-key",
    });
  });
});
