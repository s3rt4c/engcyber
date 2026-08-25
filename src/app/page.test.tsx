import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";
import DiscoverPage from "@/app/discover/page";

describe("M9 route entry points", () => {
  it("makes the root an action-first local Daily Learning Hub", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("Today");
    expect(html).toContain("browser-local learning activity");
    expect(html).not.toContain("Discover authentic English");
    expect(html).not.toContain("Gemini");
    expect(html).not.toContain("OpenAI");
  });

  it("keeps curated discovery on /discover", () => {
    const html = renderToStaticMarkup(<DiscoverPage />);

    expect(html).toContain("Discover authentic English");
    expect(html).toContain("metadata is fetched without generating lessons or calling AI");
    expect(html).toContain("Cybersecurity News");
  });
});
