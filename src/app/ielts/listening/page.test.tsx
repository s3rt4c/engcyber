import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import IeltsListeningPage from "@/app/ielts/listening/page";

describe("M12 IELTS Listening route", () => {
  it("renders eight local Listening practice choices without a Speaking entry", () => {
    const page = renderToStaticMarkup(<IeltsListeningPage />);
    expect(page).toContain("IELTS-oriented Listening");
    expect(page).toContain("Community library card");
    expect(page).toContain("Energy-use lecture");
    expect(page).not.toContain("Speaking practice");
    expect(page).not.toContain("fetch(");
  });
});
