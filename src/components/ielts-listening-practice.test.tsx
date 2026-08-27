import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IeltsListeningPractice } from "@/components/ielts-listening-practice";

describe("M12 IELTS Listening practice UI", () => {
  it("does not render authored transcript or answers while a local session has not loaded", () => {
    const page = renderToStaticMarkup(<IeltsListeningPractice sessionId="missing" />);
    expect(page).toContain("unavailable in this browser");
    expect(page).not.toContain("proof of address");
    expect(page).not.toContain("Correct answer");
  });
});
