import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell";

describe("M9 shared application shell", () => {
  it("exposes the accepted text-based learning navigation and secondary Add Content action", () => {
    const html = renderToStaticMarkup(<AppShell><p>Route content</p></AppShell>);

    expect(html).toContain('aria-label="Primary navigation"');
    for (const label of ["Home", "Discover", "Library", "Review", "Listening", "Podcasts", "Progress", "Add Content"]) expect(html).toContain(`>${label}<`);
    expect(html).toContain("Route content");
    expect(html).toContain('aria-current="page" href="/">Home<');
  });
});
