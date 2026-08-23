import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("M0 home shell", () => {
  it("shows the four planned learning areas without offering automatic lessons", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("Discover");
    expect(html).toContain("My Content");
    expect(html).toContain("Review");
    expect(html).toContain("Progress");
    expect(html).toContain("Lessons are created only when you choose an item.");
  });
});
