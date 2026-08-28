import { expect, test } from "./fixtures/browser";

test("serves the production security envelope without invoking a provider", async ({ page, baseURL }) => {
  const document = await page.goto("/");
  expect(document?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(document?.headers()["x-frame-options"]).toBe("DENY");
  expect(document?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(document?.headers()["permissions-policy"]).toContain("camera=()");
  expect(document?.headers()["x-powered-by"]).toBeUndefined();

  const crossSite = await page.request.fetch(`${baseURL}/api/actions`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://cross-site.example", "sec-fetch-site": "cross-site" },
    data: {},
  });
  expect(crossSite.status()).toBe(403);
  expect(crossSite.headers()["cache-control"]).toBe("no-store");

  const wrongContentType = await page.request.fetch(`${baseURL}/api/actions`, {
    method: "POST",
    headers: { "content-type": "text/plain", origin: baseURL! },
    data: "not JSON",
  });
  expect(wrongContentType.status()).toBe(415);

  const oversized = await page.request.fetch(`${baseURL}/api/actions`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseURL! },
    data: { selectedText: "x".repeat(17_000) },
  });
  expect(oversized.status()).toBe(413);
});
