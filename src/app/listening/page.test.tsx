import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ListeningPage from "@/app/listening/page";

describe("M5 listening route", () => {
  it("renders a local listening entry point without server-side provider work", () => {
    const page = renderToStaticMarkup(<ListeningPage />);
    expect(page).toContain("Listening Practice");
    expect(page).toContain("Choose a saved lesson");
    expect(page).not.toContain("Gemini");
    expect(page).not.toContain("OpenAI");
  });
});
