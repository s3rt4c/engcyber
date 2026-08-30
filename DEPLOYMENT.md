# Private deployment architecture

**The repository is ready for the selected private-deployment architecture, but external Cloudflare Access, DNS, Vercel production configuration, Upstash production state, HSTS, CSP measurement, and deployment smoke acceptance are still pending.** This document does not mean the application is deployed or that any supplied URL is protected.

## Selected topology

```text
Internet -> Cloudflare Access -> Cloudflare-proxied custom HTTPS hostname
         -> Vercel / Next.js origin -> M17 Access JWT verification
         -> Upstash Redis controls -> M16 request envelope -> provider or safe fetch
```

Cloudflare Access decides who may enter. Next.js independently verifies the `Cf-Access-Jwt-Assertion` at the origin, so a direct Vercel hostname without a valid assertion cannot bypass private access. Upstash Redis stores only opaque-subject hashes, rate state, timestamps, and synthetic lease IDs; learner data and backups never leave browser storage.

## Manual external configuration

1. Create a Vercel project for this repository and configure a production custom hostname.
2. Proxy that hostname through Cloudflare DNS and create one Cloudflare Access application for it.
3. Create an Allow policy for the one approved identity and deny all others by default.
4. Configure production-only environment values: `ENGCYBER_ACCESS_MODE=cloudflare`, `CLOUDFLARE_ACCESS_TEAM_DOMAIN`, `CLOUDFLARE_ACCESS_AUD`, `ENGCYBER_APP_ORIGIN`, provider keys, and Upstash REST credentials.
5. Create an Upstash Redis database for control-plane state only. Exhaustion or outage must fail closed for provider and external-fetch routes.
6. Do not provide live provider, Access, or Upstash secrets to Vercel Preview environments. Preview URLs must remain disabled, separately Access-protected, or fail closed.

Never commit real domains, Access assertions, cookies, provider keys, Vercel tokens, Upstash URLs, or Upstash tokens.

## Initial policy

- One verified Access `sub` shares a burst-three, six-per-minute AI bucket across all six AI capabilities.
- The same subject may hold at most two concurrently admitted EngCyber AI operations. Each lease expires after 90 seconds and is released in `finally`.
- Manual URL import is burst two, three per minute.
- Discovery, podcasts, and transcript retrieval are burst ten, 30 per minute, separate from AI and manual URL import.
- Token exhaustion returns safe `429`; a truthful token-bucket delay is returned as `Retry-After`. Concurrent-AI saturation returns `429` without a fabricated retry time.
- Redis unavailability returns safe `503` before provider or expensive upstream fetch work.

One learner action consumes one AI token and one lease even when its existing provider boundary makes up to three transient attempts. AI concurrency limits admitted EngCyber operations; Gemini work may outlive client-side timeout/cancellation. The lease is not a claim of provider-side cancellation or hard Gemini-backend concurrency.

## HTTPS, HSTS, and CSP

Terminate TLS at Cloudflare/Vercel, not in Next.js. After the canonical HTTPS hostname is stable, enable edge HSTS initially without preload or broad `includeSubDomains`. CSP remains deferred: collect report-only/browser evidence, verify with isolated Playwright, then enforce a measured policy. Do not add an application-level HSTS or CSP policy during this repository phase.

## Deployment acceptance

Use an isolated browser or HTTP client and verify: unauthenticated canonical access is blocked by Access; direct Vercel access without a JWT is denied by the application; forged canonical Origin alone does not bypass Access; authenticated pages/APIs work; rate and concurrency saturation return `429`; Redis loss returns `503`; and response headers remain present. Make one manually triggered, authenticated provider call after deployment; never place provider acceptance in CI.

`npm test`, `quality`, and `e2e` remain merge gates. Existing local Playwright uses explicit local-test Access mode and never performs a real Cloudflare login.
