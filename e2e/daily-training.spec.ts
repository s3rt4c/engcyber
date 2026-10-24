import { trainingFixture } from "../src/test/daily-training-fixtures";
import { seedStorage } from "./fixtures/storage";
import { expect, test } from "./fixtures/browser";

test("derives the daily queue without writes and recomputes after an explicit local Review", async ({ page }) => {
  const now = "2026-10-24T12:00:00.000Z";
  const fixture = await trainingFixture(now);
  const seed = fixture.storage.contents();
  await page.clock.setFixedTime(new Date(now));
  await seedStorage(page, seed);
  await page.addInitScript(() => {
    const state = window as typeof window & { homeWrites: number };
    state.homeWrites = 0;
    for (const method of ["setItem", "removeItem", "clear"] as const) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args: string[]) {
        if (this === window.localStorage && window.sessionStorage.getItem("engcyber-e2e-seeded") === "1") state.homeWrites++;
        return Reflect.apply(original, this, args);
      };
    }
  });
  const apiRequests: string[] = [];
  const keyWarnings: string[] = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });
  page.on("console", (message) => { if (/unique.*key|same key/iu.test(message.text())) keyWarnings.push(message.text()); });
  const storage = () => page.evaluate(() => Object.fromEntries(Object.entries(window.localStorage)));
  const writes = () => page.evaluate(() => (window as typeof window & { homeWrites: number }).homeWrites);
  await page.goto("/");
  const training = page.getByRole("region", { name: "Today's training" });
  const links = training.getByRole("link");
  await expect(links).toHaveCount(3);
  expect(await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")))).toEqual(["/review", "/vocabulary", "/library/lessons/training-lesson"]);
  await expect(training).toContainText("1 error-pattern review is overdue.");
  expect(await storage()).toEqual(seed); expect(await writes()).toBe(0);

  await links.first().focus();
  await expect(links.first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/review$/u);
  await expect(page.getByRole("heading", { name: "Error Pattern Review" })).toBeVisible();
  await page.getByRole("button", { name: "Start Review", exact: true }).click();
  await page.getByLabel("Your answer", { exact: true }).fill(fixture.occurrence.correctedText);
  await page.getByRole("button", { name: "Check Answer", exact: true }).click();
  await expect(page.getByText("Review events recorded: 1")).toBeVisible();
  const afterReview = await storage();
  expect(afterReview).not.toEqual(seed);

  await page.goto("/");
  await expect(links).toHaveCount(3);
  expect(await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")))).toEqual(["/vocabulary", "/library/lessons/training-lesson", "/ielts/reading/training-reading"]);
  expect(await storage()).toEqual(afterReview); expect(await writes()).toBe(0);
  await page.reload();
  await expect(links.first()).toHaveAttribute("href", "/vocabulary");
  expect(await storage()).toEqual(afterReview); expect(await writes()).toBe(0);
  expect(Object.keys(afterReview).sort()).toEqual(Object.keys(seed).sort());
  expect(apiRequests).toEqual([]); expect(keyWarnings).toEqual([]);
});
