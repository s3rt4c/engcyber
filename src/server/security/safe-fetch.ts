import "server-only";

import { lookup } from "node:dns/promises";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2_000_000;
export const transcriptResponseMaximumBytes = 512 * 1024;
const articleTextTypes = ["text/html", "application/xhtml+xml", "text/plain"];
const feedXmlTypes = ["application/rss+xml", "application/atom+xml", "application/xml", "text/xml"];

type LookupResult = { address: string; family: number };
export type SafeFetchOptions = { fetcher?: typeof fetch; lookup?: (host: string, options: { all: true }) => Promise<LookupResult[]> };
type FetchPolicy = { readonly acceptedContentTypes: readonly string[]; readonly contentLabel: string; readonly acceptHeader: string; readonly requireHttps: boolean; readonly maximumBytes: number; readonly allowedHosts?: readonly string[]; readonly revalidate?: number; };

function isUnsafeIpv4(value: string): boolean {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || (a === 100 && b >= 64 && b <= 127) || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113) || a >= 224;
}

function isUnsafeAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  return isUnsafeIpv4(normalized) || normalized === "::1" || normalized === "::" || /^fe[89ab][0-9a-f]:/.test(normalized) || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("ff") || normalized.startsWith("::ffff:");
}

export function assertPublicHttpUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("URL is invalid"); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || isUnsafeAddress(host)) throw new Error("URL targets an unsafe or unsupported location");
  return url;
}

function assertPublicHttpsUrl(input: string): URL {
  const url = assertPublicHttpUrl(input);
  if (url.protocol !== "https:") throw new Error("Feed URL must use HTTPS");
  return url;
}

async function assertPublicResolution(url: URL, resolver: SafeFetchOptions["lookup"]): Promise<void> {
  const resolve: NonNullable<SafeFetchOptions["lookup"]> = resolver ?? (async (host, options) => await lookup(host, options) as LookupResult[]);
  const addresses = await resolve(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isUnsafeAddress(address))) throw new Error("URL resolves to an unsafe location");
}

async function readCappedText(response: Response, contentLabel: string, maximumBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) { await reader.cancel(); throw new Error(`${contentLabel} response is too large`); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function fetchValidatedExternalText(input: string, policy: FetchPolicy, options: SafeFetchOptions): Promise<{ url: string; text: string }> {
  const request = options.fetcher ?? fetch;
  let url = policy.requireHttps ? assertPublicHttpsUrl(input) : assertPublicHttpUrl(input);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (policy.allowedHosts && !policy.allowedHosts.includes(url.hostname)) throw new Error(`${policy.contentLabel} URL is not an approved publisher`);
    await assertPublicResolution(url, options.lookup);
    const requestInit: RequestInit & { next?: { revalidate: number } } = { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { Accept: policy.acceptHeader } };
    if (policy.revalidate) requestInit.next = { revalidate: policy.revalidate };
    const response = await request(url, requestInit);
    if (response.status >= 300 && response.status < 400) {
      const target = response.headers.get("location");
      if (!target || redirects === MAX_REDIRECTS) throw new Error(`${policy.contentLabel} redirect could not be safely followed`);
      url = policy.requireHttps ? assertPublicHttpsUrl(new URL(target, url).toString()) : assertPublicHttpUrl(new URL(target, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`${policy.contentLabel} request failed with ${response.status}`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!policy.acceptedContentTypes.some((type) => contentType.startsWith(type))) throw new Error(`${policy.contentLabel} response is not ${policy.contentLabel === "Feed" ? "XML" : "readable text"}`);
    if (Number(response.headers.get("content-length") ?? 0) > policy.maximumBytes) throw new Error(`${policy.contentLabel} response is too large`);
    return { url: url.toString(), text: await readCappedText(response, policy.contentLabel, policy.maximumBytes) };
  }
  throw new Error(`${policy.contentLabel} redirect limit reached`);
}

export async function fetchValidatedText(input: string, options: SafeFetchOptions = {}): Promise<{ url: string; html: string }> {
  const result = await fetchValidatedExternalText(input, { acceptedContentTypes: articleTextTypes, contentLabel: "Article", acceptHeader: articleTextTypes.join(","), requireHttps: false, maximumBytes: MAX_BYTES }, options);
  return { url: result.url, html: result.text };
}

export async function fetchValidatedFeedText(input: string, options: SafeFetchOptions = {}): Promise<{ url: string; xml: string }> {
  const result = await fetchValidatedExternalText(input, { acceptedContentTypes: feedXmlTypes, contentLabel: "Feed", acceptHeader: feedXmlTypes.join(","), requireHttps: true, maximumBytes: MAX_BYTES, revalidate: 900 }, options);
  return { url: result.url, xml: result.text };
}

export async function fetchValidatedTranscriptHtml(input: string, options: SafeFetchOptions = {}): Promise<{ url: string; html: string }> {
  const result = await fetchValidatedExternalText(input, { acceptedContentTypes: ["text/html", "application/xhtml+xml"], contentLabel: "Transcript", acceptHeader: "text/html,application/xhtml+xml", requireHttps: true, maximumBytes: transcriptResponseMaximumBytes, allowedHosts: ["darknetdiaries.com"], revalidate: 900 }, options);
  return { url: result.url, html: result.text };
}
