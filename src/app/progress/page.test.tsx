import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ProgressPage from "@/app/progress/page";

describe("M8 progress route", () => {
  it("renders a local-only progress entry point without provider or score claims", () => {
    const html = renderToStaticMarkup(<ProgressPage />);

    expect(html).toContain("Progress");
    expect(html).toContain("7 days");
    expect(html).toContain("browser-local learning evidence");
    expect(html).not.toContain("Gemini");
    expect(html).not.toContain("OpenAI");
    expect(html).not.toContain("Overall progress");
    expect(html).not.toContain("IELTS");
    expect(html).not.toContain("CEFR");
  });
});
