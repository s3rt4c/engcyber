# Security posture

M16 implements an application security envelope. It does not approve EngCyber for unauthenticated public deployment.

## Application controls

- Every POST API route accepts only JSON, reads a route-specific bounded UTF-8 byte stream before parsing, requires an exact accepted Origin, and rejects cross-site browser metadata where present.
- API responses are `Cache-Control: no-store`; public errors are stable and do not expose raw provider, DNS, or upstream exception details.
- Baseline headers disable `X-Powered-By`, content sniffing, framing, referrer transfer, and unused browser permissions. CSP is intentionally deferred until a real deployment/runtime can be tested. HSTS belongs at the HTTPS deployment edge, not local application configuration.
- Provider calls are explicit and tool-free. OpenAI uses `store: false`, a supported 20-second request timeout, and no SDK retries; EngCyber retains its maximum three-attempt transient retry policy. Gemini caller wait is bounded to 20 seconds, but an upstream request may continue after that caller timeout.
- Manual URL, RSS, and transcript retrieval retain server-side scheme, credential, DNS/IP, redirect, content-type, timeout, and byte-cap protections. DNS rebinding between validation and connection remains a residual runtime-fetch limitation.

## Deployment blockers

M17 selects Cloudflare Access in front of a Cloudflare-proxied custom hostname and Vercel origin. Next.js verifies Cloudflare Access JWTs itself so a direct Vercel hostname cannot bypass the gateway, and Upstash Redis supplies per-subject distributed rate buckets and at most two concurrently admitted EngCyber AI operations. Gemini work may outlive client-side timeout/cancellation, so the leases do not assert provider-side cancellation or hard Gemini-backend concurrency. **The repository is ready for the selected private-deployment architecture, but external Cloudflare Access, DNS, Vercel production configuration, Upstash production state, HSTS, CSP measurement, and deployment smoke acceptance are still pending.** Same-origin validation remains defense in depth, not authentication.

Production Access mode fails closed for missing configuration, missing/invalid JWTs, or unavailable signing-key verification. Provider-cost and external-fetch routes fail closed with safe 503 when Upstash control state is unavailable. No custom login, account database, server learner store, cloud sync, CSP enforcement, application HSTS configuration, or public multi-user model is included.

## Data boundaries

Learner state and `engcyber-backup` v1 remain browser-local. Backup files are not uploaded to an API route. Provider credentials are server-only; never commit `.env.local` or use public provider-key variables.
