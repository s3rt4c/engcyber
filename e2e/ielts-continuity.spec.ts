import { completedIeltsSeed, continuationSeed, seedStorage } from "./fixtures/storage";
import { expect, test } from "./fixtures/browser";

test("follows an unfinished IELTS Reading continuation through reload and completion", async ({ page }) => {
  await seedStorage(page, continuationSeed());
  await page.goto("/");

  const continuationSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Continue IELTS Practice" }) });
  const readingLink = continuationSection.getByRole("link", { name: "Continue Reading" });
  await expect(continuationSection.getByRole("link")).toHaveCount(3);
  await expect(readingLink).toHaveAttribute("href", "/ielts/reading/reading-open");
  await readingLink.click();
  await expect(page).toHaveURL(/\/ielts\/reading\/reading-open$/u);
  await expect(page.getByRole("heading", { name: "Synthetic resilience report" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Synthetic resilience report" })).toBeVisible();
  for (const name of ["mc-1", "mc-2", "mc-3", "tfng-1", "tfng-2", "tfng-3"]) {
    const option = page.locator(`input[name="${name}"]`).first();
    await option.check();
    await expect(option).toBeChecked();
  }
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("heading", { name: "6 of 6 correct in this practice" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "6 of 6 correct in this practice" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Continue Reading" })).toHaveCount(0);
  await expect(continuationSection.getByRole("link")).toHaveCount(2);
});

test("renders completed IELTS activity once per event and once for Listening in Progress", async ({ page }) => {
  await seedStorage(page, completedIeltsSeed());
  await page.goto("/ielts");

  const activity = page.locator("section").filter({ has: page.getByRole("heading", { name: "Recent IELTS activity" }) });
  await expect(activity.getByRole("link", { name: "IELTS Reading completed" })).toHaveCount(1);
  await expect(activity.getByRole("link", { name: "Task 2 initial feedback completed" })).toHaveCount(2);
  await expect(activity.getByRole("link", { name: "Task 2 revision reviewed" })).toHaveCount(1);
  await expect(activity.getByRole("link", { name: "IELTS Listening completed" })).toHaveCount(1);
  await expect(activity.getByText("6 / 6 correct", { exact: false })).toHaveCount(2);
  await expect(page.getByText("Speaking", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Overall", { exact: true })).toHaveCount(0);

  await page.goto("/progress");
  const ieltsSummary = page.locator("article").filter({ has: page.getByRole("heading", { name: "IELTS-style practice" }) });
  await expect(ieltsSummary.getByRole("heading", { name: "IELTS-style practice" })).toBeVisible();
  await expect(ieltsSummary.getByText("Reading completed", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("1");
  await expect(ieltsSummary.getByText("Writing analyses", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("2");
  await expect(ieltsSummary.getByText("Revision reviews", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("1");
  await expect(ieltsSummary.getByText("Listening completed", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("1");
  await expect(ieltsSummary.getByText("Listening correct / total", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("6 / 6");
  await expect(page.getByLabel("Activity timeline").getByText("5", { exact: true })).toHaveCount(1);
});
