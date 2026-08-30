import { errors, exportJWK, generateKeyPair, SignJWT, createLocalJWKSet, type JWK } from "jose";
import { describe, expect, it } from "vitest";

import { ACCESS_SUBJECT_HEADER, accessRequestHeaders, authorizeAccessRequest, readAccessConfiguration, verifyCloudflareAccessJwt, type RequiredAccessConfiguration } from "@/server/access-control";

const issuer = "https://engcyber.cloudflareaccess.com";
const audience = "private-engcyber";

async function signedToken(overrides: Record<string, unknown> = {}) {
  const keys = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(keys.publicKey) as JWK;
  publicJwk.kid = "test-key";
  const token = await new SignJWT({ ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("access-subject-a")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
  return { token, jwks: createLocalJWKSet({ keys: [publicJwk] }) };
}

const requiredConfiguration: RequiredAccessConfiguration = {
  mode: "cloudflare",
  issuer,
  audience,
  jwksUrl: new URL(`${issuer}/cdn-cgi/access/certs`),
};

describe("Cloudflare Access configuration", () => {
  it("uses explicit local mode outside production", () => {
    expect(readAccessConfiguration({ NODE_ENV: "test" })).toEqual({ mode: "local" });
  });

  it("fails closed for development without the explicit loopback local-test seam", () => {
    expect(readAccessConfiguration({ NODE_ENV: "development", ENGCYBER_ACCESS_MODE: "local", ENGCYBER_APP_ORIGIN: "https://engcyber.example.com" })).toEqual({ mode: "unavailable" });
  });

  it("permits local mode under next start only with an explicit local test marker and loopback canonical origin", () => {
    expect(readAccessConfiguration({ NODE_ENV: "production", ENGCYBER_ACCESS_MODE: "local", ENGCYBER_LOCAL_TEST_MODE: "true", ENGCYBER_APP_ORIGIN: "http://127.0.0.1:3100" })).toEqual({ mode: "local" });
  });

  it("fails closed when a production or preview deployment tries to enable local mode for a public canonical origin", () => {
    expect(readAccessConfiguration({ NODE_ENV: "production", ENGCYBER_ACCESS_MODE: "local", ENGCYBER_LOCAL_TEST_MODE: "true", ENGCYBER_APP_ORIGIN: "https://engcyber.example.com" })).toEqual({ mode: "unavailable" });
  });

  it("fails closed when a Vercel Preview deployment tries to use the local-test seam", () => {
    expect(readAccessConfiguration({ NODE_ENV: "production", VERCEL_ENV: "preview", ENGCYBER_ACCESS_MODE: "local", ENGCYBER_LOCAL_TEST_MODE: "true", ENGCYBER_APP_ORIGIN: "http://127.0.0.1:3100" })).toEqual({ mode: "unavailable" });
  });

  it("fails closed for production without complete Access configuration", () => {
    expect(readAccessConfiguration({ NODE_ENV: "production" })).toEqual({ mode: "unavailable" });
  });
});

describe("Cloudflare Access JWT verification", () => {
  it("accepts a valid signed token and returns its opaque subject", async () => {
    const { token, jwks } = await signedToken();
    await expect(verifyCloudflareAccessJwt(token, requiredConfiguration, { jwks })).resolves.toEqual({ subject: "access-subject-a" });
  });

  it("rejects a token for the wrong audience", async () => {
    const { token, jwks } = await signedToken({});
    await expect(verifyCloudflareAccessJwt(token, { ...requiredConfiguration, audience: "other-app" }, { jwks })).rejects.toThrow("Access token is invalid.");
  });

  it("rejects a token for the wrong issuer", async () => {
    const { token, jwks } = await signedToken({});
    await expect(verifyCloudflareAccessJwt(token, { ...requiredConfiguration, issuer: "https://other.cloudflareaccess.com" }, { jwks })).rejects.toThrow("Access token is invalid.");
  });

  it("rejects an expired token", async () => {
    const keys = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(keys.publicKey) as JWK;
    publicJwk.kid = "expired-key";
    const token = await new SignJWT()
      .setProtectedHeader({ alg: "RS256", kid: "expired-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject("access-subject-a")
      .setIssuedAt()
      .setExpirationTime("-1s")
      .sign(keys.privateKey);
    await expect(verifyCloudflareAccessJwt(token, requiredConfiguration, { jwks: createLocalJWKSet({ keys: [publicJwk] }) })).rejects.toThrow("Access token is invalid.");
  });

  it("does not authorize a client-supplied internal subject without a token", async () => {
    const request = new Request("https://origin.vercel.app/api/lessons/generate", {
      headers: { [ACCESS_SUBJECT_HEADER]: "forged-subject" },
    });
    await expect(authorizeAccessRequest(request, { NODE_ENV: "production", ENGCYBER_ACCESS_MODE: "cloudflare", CLOUDFLARE_ACCESS_TEAM_DOMAIN: "engcyber.cloudflareaccess.com", CLOUDFLARE_ACCESS_AUD: audience })).resolves.toEqual({ kind: "denied", status: 401, publicMessage: "Access is required." });
  });

  it("fails closed as unavailable when JWKS retrieval fails", async () => {
    const request = new Request("https://origin.vercel.app/api/lessons/generate", { headers: { "cf-access-jwt-assertion": "synthetic" } });
    const environment = { NODE_ENV: "production", ENGCYBER_ACCESS_MODE: "cloudflare", CLOUDFLARE_ACCESS_TEAM_DOMAIN: "engcyber.cloudflareaccess.com", CLOUDFLARE_ACCESS_AUD: audience };
    await expect(authorizeAccessRequest(request, environment, { verify: async () => { throw new Error("JWKS unavailable"); } })).resolves.toEqual({ kind: "denied", status: 503, publicMessage: "Access verification is unavailable." });
  });

  it("classifies a JWKS timeout as unavailable rather than an invalid user credential", async () => {
    const { token } = await signedToken();
    await expect(verifyCloudflareAccessJwt(token, requiredConfiguration, { jwks: async () => { throw new errors.JWKSTimeout(); } })).rejects.toEqual(new (await import("@/server/access-control")).AccessControlError(503, "Access verification is unavailable."));
  });

  it("replaces an untrusted internal subject with the verified value only", () => {
    const headers = accessRequestHeaders(new Headers({ [ACCESS_SUBJECT_HEADER]: "forged-subject" }), { kind: "allowed", subject: "access-subject-a" });
    expect(headers.get(ACCESS_SUBJECT_HEADER)).toBe("access-subject-a");
  });
});
