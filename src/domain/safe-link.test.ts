import { describe, expect, it } from "vitest";

import { safeExternalHttpUrl } from "@/domain/safe-link";

describe("safe external links", () => {
  it("allows ordinary HTTP(S) publisher links and rejects executable or credential-bearing storage values", () => {
    expect(safeExternalHttpUrl("https://example.com/article?ref=engcyber")).toBe("https://example.com/article?ref=engcyber");
    expect(safeExternalHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalHttpUrl("https://user:password@example.com/report")).toBeNull();
    expect(safeExternalHttpUrl("file:///C:/private.txt")).toBeNull();
  });
});
