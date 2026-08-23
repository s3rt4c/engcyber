import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("M1 discover shell", () => {
  it("shows authentic-content discovery without offering automatic lessons", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("Discover");
    expect(html).toContain("My Content");
    expect(html).toContain("Discover authentic English");
    expect(html).toContain("metadata is fetched without generating lessons or calling AI");
    expect(html).toContain("Cybersecurity News");
    expect(html).toContain("Artificial Intelligence");
  });
});
