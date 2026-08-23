import "server-only";

import { lookup } from "node:dns/promises";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2_000_000;
const textTypes = ["text/html", "application/xhtml+xml", "text/plain"];

type LookupResult = { address: string; family: number };
type SafeFetchOptions = { fetcher?: typeof fetch; lookup?: (host: string, options: { all: true }) => Promise<LookupResult[]> };

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

async function assertPublicResolution(url: URL, resolver: SafeFetchOptions["lookup"]): Promise<void> {
  const resolve: NonNullable<SafeFetchOptions["lookup"]> = resolver ?? (async (host, options) => await lookup(host, options) as LookupResult[]);
  const addresses = await resolve(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isUnsafeAddress(address))) throw new Error("URL resolves to an unsafe location");
}

async function readCappedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Article response is too large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function fetchValidatedText(input: string, options: SafeFetchOptions = {}): Promise<{ url: string; html: string }> {
  const request = options.fetcher ?? fetch;
  let url = assertPublicHttpUrl(input);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertPublicResolution(url, options.lookup);
    const response = await request(url, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { Accept: "text/html,application/xhtml+xml,text/plain" } });
    if (response.status >= 300 && response.status < 400) {
      const target = response.headers.get("location");
      if (!target || redirects === MAX_REDIRECTS) throw new Error("Article redirect could not be safely followed");
      url = assertPublicHttpUrl(new URL(target, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Article request failed with ${response.status}`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!textTypes.some((type) => contentType.startsWith(type))) throw new Error("Article response is not readable text");
    if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("Article response is too large");
    return { url: url.toString(), html: await readCappedText(response) };
  }
  throw new Error("Article redirect limit reached");
}
