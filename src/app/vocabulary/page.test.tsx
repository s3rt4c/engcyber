import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import VocabularyPage from "@/app/vocabulary/page";

describe("M10 vocabulary route", () => {
  it("renders a local-only phrase-retrieval entry point without provider claims", () => {
    const html = renderToStaticMarkup(<VocabularyPage />);

    expect(html).toContain("Vocabulary review");
    expect(html).toContain("Saved phrases stay in this browser");
    expect(html).not.toContain("Gemini");
    expect(html).not.toContain("OpenAI");
  });
});
