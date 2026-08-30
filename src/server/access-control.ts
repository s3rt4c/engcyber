import "server-only";

import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";

export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
export const ACCESS_SUBJECT_HEADER = "x-engcyber-access-subject";
export const localAccessSubject = "local-development";

type Environment = Record<string, string | undefined>;

export type RequiredAccessConfiguration = {
  readonly mode: "cloudflare";
  readonly issuer: string;
  readonly audience: string;
  readonly jwksUrl: URL;
};

export type AccessConfiguration = { readonly mode: "local" | "unavailable" } | RequiredAccessConfiguration;

export type AccessAuthorization =
  | { readonly kind: "allowed"; readonly subject: string }
  | { readonly kind: "denied"; readonly status: 401 | 503; readonly publicMessage: string };

export class AccessControlError extends Error {
  constructor(readonly status: 401 | 503, readonly publicMessage: string) {
    super(publicMessage);
  }
}

function optionalValue(env: Environment, name: string): string | undefined {
  const value = env[name]?.trim();
  return value || undefined;
}

function cloudflareConfiguration(env: Environment): RequiredAccessConfiguration | null {
  const teamDomain = optionalValue(env, "CLOUDFLARE_ACCESS_TEAM_DOMAIN");
  const audience = optionalValue(env, "CLOUDFLARE_ACCESS_AUD");
  if (!teamDomain || !audience || !/^[a-z0-9.-]+$/iu.test(teamDomain)) return null;
  const issuer = `https://${teamDomain}`;
  return { mode: "cloudflare", issuer, audience, jwksUrl: new URL("/cdn-cgi/access/certs", issuer) };
}

function hasLoopbackCanonicalOrigin(env: Environment): boolean {
  const value = optionalValue(env, "ENGCYBER_APP_ORIGIN");
  if (!value) return false;
  try {
    const origin = new URL(value);
    return origin.origin === value && (origin.hostname === "localhost" || origin.hostname === "127.0.0.1" || origin.hostname === "[::1]");
  } catch {
    return false;
  }
}

/** Reads explicit access mode; production never infers public access from request metadata. */
export function readAccessConfiguration(env: Environment = process.env): AccessConfiguration {
  const requestedMode = optionalValue(env, "ENGCYBER_ACCESS_MODE");
  const localTestMode = env.ENGCYBER_LOCAL_TEST_MODE === "true";
  const explicitLoopbackLocalTest = localTestMode && !optionalValue(env, "VERCEL_ENV") && hasLoopbackCanonicalOrigin(env);
  if ((env.NODE_ENV === "test" || explicitLoopbackLocalTest) && (!requestedMode || requestedMode === "local")) return { mode: "local" };
  if (requestedMode !== "cloudflare") return { mode: "unavailable" };
  return cloudflareConfiguration(env) ?? { mode: "unavailable" };
}

const remoteJwksByUrl = new Map<string, JWTVerifyGetKey>();

function remoteJwks(url: URL): JWTVerifyGetKey {
  const key = url.toString();
  const existing = remoteJwksByUrl.get(key);
  if (existing) return existing;
  const created = createRemoteJWKSet(url);
  remoteJwksByUrl.set(key, created);
  return created;
}

export async function verifyCloudflareAccessJwt(
  token: string,
  configuration: RequiredAccessConfiguration,
  dependencies: { readonly jwks?: JWTVerifyGetKey } = {},
): Promise<{ readonly subject: string }> {
  try {
    const verified = await jwtVerify(token, dependencies.jwks ?? remoteJwks(configuration.jwksUrl), {
      issuer: configuration.issuer,
      audience: configuration.audience,
    });
    const subject = verified.payload.sub?.trim();
    if (!subject) throw new AccessControlError(401, "Access token is invalid.");
    return { subject };
  } catch (error) {
    if (error instanceof AccessControlError) throw error;
    if (!(error instanceof errors.JOSEError)) throw new AccessControlError(503, "Access verification is unavailable.");
    if (error.code === "ERR_JWKS_TIMEOUT" || error.code === "ERR_JOSE_GENERIC" || error.code === "ERR_JWKS_INVALID") {
      throw new AccessControlError(503, "Access verification is unavailable.");
    }
    throw new AccessControlError(401, "Access token is invalid.");
  }
}

/** Verifies the Access assertion; this intentionally ignores every client-supplied internal subject header. */
export async function authorizeAccessRequest(
  request: Request,
  env: Environment = process.env,
  dependencies: { readonly verify?: (token: string, configuration: RequiredAccessConfiguration) => Promise<{ readonly subject: string }> } = {},
): Promise<AccessAuthorization> {
  const configuration = readAccessConfiguration(env);
  if (configuration.mode === "local") return { kind: "allowed", subject: localAccessSubject };
  if (configuration.mode !== "cloudflare") return { kind: "denied", status: 503, publicMessage: "Access verification is unavailable." };
  const token = request.headers.get(ACCESS_JWT_HEADER)?.trim();
  if (!token) return { kind: "denied", status: 401, publicMessage: "Access is required." };
  try {
    return { kind: "allowed", ...(await (dependencies.verify ?? verifyCloudflareAccessJwt)(token, configuration)) };
  } catch (error) {
    if (error instanceof AccessControlError) return { kind: "denied", status: error.status, publicMessage: error.publicMessage };
    return { kind: "denied", status: 503, publicMessage: "Access verification is unavailable." };
  }
}

/** Removes an untrusted supplied value and propagates only a verified subject to Next route handlers. */
export function accessRequestHeaders(headers: Headers, authorization: AccessAuthorization): Headers {
  const trusted = new Headers(headers);
  trusted.delete(ACCESS_SUBJECT_HEADER);
  if (authorization.kind === "allowed" && authorization.subject !== localAccessSubject) trusted.set(ACCESS_SUBJECT_HEADER, authorization.subject);
  return trusted;
}

/** Route handlers use this only after Proxy has admitted production traffic. */
export function accessSubjectForRequest(request: Request, env: Environment = process.env): string {
  const configuration = readAccessConfiguration(env);
  if (configuration.mode === "local") return localAccessSubject;
  const subject = request.headers.get(ACCESS_SUBJECT_HEADER)?.trim();
  if (!subject) throw new AccessControlError(401, "Access is required.");
  return subject;
}
