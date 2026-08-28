import type { Download } from "@playwright/test";
import { backupSeed, seedStorage, unrelatedSentinel, unrelatedSentinelValue } from "./fixtures/storage";
import { expect, test } from "./fixtures/browser";

async function downloadedText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Playwright did not expose the backup download stream.");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function keys(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [key, ...keys(child)]);
}

test("exports, restores, and reloads a synthetic browser backup", async ({ page }) => {
  await seedStorage(page, backupSeed());
  await page.goto("/backup");
  await expect(page.getByRole("heading", { name: "Data & Backup" })).toBeVisible();
  await expect(page.getByText("1 phrases", { exact: false })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^engcyber-backup-\d{4}-\d{2}-\d{2}\.json$/u);
  const text = await downloadedText(download);
  const manifest = JSON.parse(text) as Record<string, unknown>;
  expect(manifest).toMatchObject({ format: "engcyber-backup", version: 1 });
  expect(Object.keys((manifest.stores ?? {}) as Record<string, unknown>).sort()).toEqual(["errorMemory", "errorReview", "ielts", "lessons", "listening", "phrases", "vocabularyReview", "writing"]);
  expect(text).not.toContain(unrelatedSentinel);
  expect(keys(manifest).some((key) => /(?:api[_-]?key|secret|token|password)/iu.test(key))).toBe(false);

  await page.evaluate(() => window.localStorage.setItem("engcyber.saved-phrases.v1", JSON.stringify({ version: "m9-phrases-v2", phrases: [] })));
  await page.reload();
  await expect(page.getByText("0 phrases", { exact: false })).toBeVisible();

  await page.getByLabel("Backup JSON").setInputFiles({ name: download.suggestedFilename(), mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.getByRole("heading", { name: "Validated backup preview" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Backup validated");
  await expect(page.getByText("0 phrases", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Replace local learning data" }).click();
  await expect(page.getByRole("status")).toContainText("Restore complete. Your local learning data was reloaded.");
  await expect(page).toHaveURL(/\/backup$/u);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("engcyber.saved-phrases.v1"))).toContain("critical patch");
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), unrelatedSentinel)).toBe(unrelatedSentinelValue);

  await page.reload();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByText("1 phrases", { exact: false })).toBeVisible();
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), unrelatedSentinel)).toBe(unrelatedSentinelValue);
});
