import { describe, expect, it } from "vitest";

import { buildExplicitActionInput, isSentenceAction } from "@/domain/sentence-actions";

describe("sentence support actions", () => {
  it("uses only the explicit selection and bounded context", () => {
    const input = buildExplicitActionInput({ action: "simplify", selectedText: "The attackers used credentials.", surroundingContext: "Context.".repeat(500) });
    expect(input.selectedText).toBe("The attackers used credentials.");
    expect(input.surroundingContext.length).toBeLessThanOrEqual(600);
  });

  it("accepts only the three explicit M1 actions", () => {
    expect(isSentenceAction("simplify")).toBe(true);
    expect(isSentenceAction("ask_ai")).toBe(false);
  });
});
