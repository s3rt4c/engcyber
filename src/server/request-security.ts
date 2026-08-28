import "server-only";

export class RequestSecurityError extends Error {
  constructor(readonly status: 400 | 403 | 413 | 415, readonly publicMessage: string) {
    super(publicMessage);
  }
}

export type ProtectedJsonOptions = {
  readonly maximumBytes: number;
  readonly env?: Record<string, string | undefined>;
};

export const postJsonByteLimits = {
  actions: 16 * 1024,
  reviewEvaluation: 16 * 1024,
  contentFromUrl: 8 * 1024,
  contentFromText: 256 * 1024,
  lessonIdentity: 128 * 1024,
  lessonGenerate: 128 * 1024,
  writingAnalyze: 64 * 1024,
  ieltsReadingIdentity: 128 * 1024,
  ieltsReadingGenerate: 128 * 1024,
  ieltsWritingAnalyze: 64 * 1024,
} as const;

export type ProtectedPostRoute = keyof typeof postJsonByteLimits;

function requireJsonContentType(request: Request): void {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new RequestSecurityError(415, "This endpoint requires JSON.");
}

function configuredOrigin(request: Request, env: Record<string, string | undefined>): string | null {
  const configured = env.ENGCYBER_APP_ORIGIN;
  if (configured) {
    try { return new URL(configured).origin; }
    catch { return null; }
  }
  if (env.NODE_ENV === "production") return null;
  try {
    const url = new URL(request.url);
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return url.origin;
  } catch { /* reject below */ }
  return null;
}

function requireAcceptedOrigin(request: Request, env: Record<string, string | undefined>): void {
  const expected = configuredOrigin(request, env);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (!expected || !origin || fetchSite === "cross-site") throw new RequestSecurityError(403, "This request origin is not allowed.");
  try {
    if (new URL(origin).origin !== expected) throw new RequestSecurityError(403, "This request origin is not allowed.");
  } catch (error) {
    if (error instanceof RequestSecurityError) throw error;
    throw new RequestSecurityError(403, "This request origin is not allowed.");
  }
}

async function readBoundedUtf8(request: Request, maximumBytes: number): Promise<string> {
  const advertised = request.headers.get("content-length");
  if (advertised && /^\d+$/u.test(advertised) && Number(advertised) > maximumBytes) throw new RequestSecurityError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new RequestSecurityError(400, "Malformed request.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new RequestSecurityError(413, "Request is too large.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    if (error instanceof RequestSecurityError) throw error;
    throw new RequestSecurityError(400, "Malformed request.");
  }
}

/** Validates browser-request metadata and decodes an incrementally byte-bounded JSON body. */
export async function readProtectedJson<T = unknown>(request: Request, options: ProtectedJsonOptions): Promise<T> {
  requireJsonContentType(request);
  requireAcceptedOrigin(request, options.env ?? process.env);
  const body = await readBoundedUtf8(request, options.maximumBytes);
  try { return JSON.parse(body) as T; }
  catch { throw new RequestSecurityError(400, "Malformed request."); }
}

export async function readProtectedRouteJson<T = unknown>(request: Request, route: ProtectedPostRoute, env?: Record<string, string | undefined>): Promise<T> {
  return await readProtectedJson<T>(request, { maximumBytes: postJsonByteLimits[route], env });
}
