import "server-only";

import { load, type CheerioAPI } from "cheerio";
import { createHash, randomUUID } from "node:crypto";
import type { Content, ExtractedContent } from "@/domain/models";

const noise = "script,style,iframe,form,nav,aside,footer,header,svg,noscript,template,[hidden],.usa-banner,.usa-header,.usa-navbar,.usa-nav,.c-site-header,.c-site-header-mobile,.c-global-header-btns,.c-skiplinks,.c-product-survey";

function normalisePlainText(value: string): string {
  return value.replace(/\r/g, "").split(/\n{2,}/).map((block) => block.replace(/[\t \n]+/g, " ").trim()).filter(Boolean).join("\n\n");
}

function readableBlocks($: CheerioAPI, root: ReturnType<CheerioAPI>): string {
  const blocks = root.find("h1,h2,h3,h4,p,li").map((_, element) => $(element).text().replace(/\s+/g, " ").trim()).get().filter((value) => value.length > 1);
  const end = blocks.findIndex((value) => /^(more |related |you may also like|community$|comments?$)/i.test(value));
  return [...new Set(end >= 0 ? blocks.slice(0, end) : blocks)].join("\n\n") || normalisePlainText(root.text());
}

function preferredRoot($: CheerioAPI): ReturnType<CheerioAPI> {
  return $("article").first().length ? $("article").first() : $("main").first().length ? $("main").first() : $("body").first();
}

export function sanitizeExtractedContent(raw: ExtractedContent): Content {
  const isMarkup = /<\/?[a-z][\s\S]*>/i.test(raw.rawText);
  const $ = load(raw.rawText);
  $(noise).remove();
  const sanitizedText = isMarkup ? readableBlocks($, preferredRoot($)) : normalisePlainText(raw.rawText);
  return { id: randomUUID(), feedItemId: raw.feedItemId, title: raw.title, canonicalUrl: raw.canonicalUrl, publishedAt: raw.publishedAt, author: raw.author, primaryCategory: raw.primaryCategory, tags: raw.tags, contentType: raw.contentType, sanitizedText, contentFingerprint: `sha256:${createHash("sha256").update(sanitizedText).digest("hex")}`, sanitizationStatus: "sanitized" };
}

export function extractArticle(raw: Omit<ExtractedContent, "rawText" | "externalInputTrust"> & { html: string }): ExtractedContent {
  const $ = load(raw.html);
  $(noise).remove();
  const root = preferredRoot($);
  const title = raw.title || $("title").first().text().trim() || "Untitled article";
  return { ...raw, title, rawText: readableBlocks($, root), externalInputTrust: "untrusted" };
}
