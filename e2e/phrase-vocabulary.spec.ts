import { expect, test } from "./fixtures/browser";

const paragraphText = "The resilient team applied zero trust controls before the planned maintenance window.";
const selectedPhrase = "zero trust controls";

test("selects rendered reading text, saves a phrase, and persists vocabulary enrollment", async ({ page }) => {
  await page.goto("/add-content");
  await page.getByLabel("Title").fill("Synthetic browser selection");
  await page.getByLabel("Article text").fill(`${paragraphText}\n\nSynthetic evidence remains local and provider-free.`);
  await page.getByRole("button", { name: "Open pasted text" }).click();
  await expect(page.getByRole("heading", { name: "Synthetic browser selection" })).toBeVisible();

  const paragraph = page.locator("article p").filter({ hasText: paragraphText });
  await paragraph.evaluate((node, phrase) => {
    const text = node.firstChild;
    if (!(text instanceof Text)) throw new Error("Expected a direct text node for the selected synthetic phrase.");
    const start = text.data.indexOf(phrase);
    if (start < 0) throw new Error("The requested synthetic phrase was not rendered.");
    const selection = window.getSelection();
    if (!selection) throw new Error("Browser text selection is unavailable.");
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + phrase.length);
    selection.removeAllRanges();
    selection.addRange(range);
    node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, selectedPhrase);

  await expect(page.getByText(`Selected: “${selectedPhrase}”`)).toBeVisible();
  await page.getByRole("button", { name: "Save Phrase" }).click();
  await expect(page.getByText("Phrase saved on this browser.").first()).toBeVisible();

  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(page.getByText(selectedPhrase, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to review" }).click();
  await expect(page.getByRole("status")).toContainText("Added to vocabulary review");

  await page.getByRole("link", { name: "Vocabulary", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vocabulary review" })).toBeVisible();
  await expect(page.getByText(selectedPhrase, { exact: true })).toBeVisible();
  await expect(page.getByText("Learning", { exact: true })).toBeVisible();
});
