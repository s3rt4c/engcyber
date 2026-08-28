# Security posture

M16 implements an application security envelope. It does not approve EngCyber for unauthenticated public deployment.

## Application controls

- Every POST API route accepts only JSON, reads a route-specific bounded UTF-8 byte stream before parsing, requires an exact accepted Origin, and rejects cross-site browser metadata where present.
- API responses are `Cache-Control: no-store`; public errors are stable and do not expose raw provider, DNS, or upstream exception details.
- Baseline headers disable `X-Powered-By`, content sniffing, framing, referrer transfer, and unused browser permissions. CSP is intentionally deferred until a real deployment/runtime can be tested. HSTS belongs at the HTTPS deployment edge, not local application configuration.
- Provider calls are explicit and tool-free. OpenAI uses `store: false`, a supported 20-second request timeout, and no SDK retries; EngCyber retains its maximum three-attempt transient retry policy. Gemini caller wait is bounded to 20 seconds, but an upstream request may continue after that caller timeout.
- Manual URL, RSS, and transcript retrieval retain server-side scheme, credential, DNS/IP, redirect, content-type, timeout, and byte-cap protections. DNS rebinding between validation and connection remains a residual runtime-fetch limitation.

## Deployment blockers

EngCyber must remain trusted-local or private-access until a hosting/platform/reverse-proxy access boundary and deployment-grade distributed rate limiting/concurrency controls are selected and configured. Same-origin validation is not authentication and does not stop direct HTTP clients that reproduce accepted headers. No custom login, Redis/KV limiter, account database, server learner store, cloud sync, CSP enforcement, or HSTS configuration is included in M16.

## Data boundaries

Learner state and `engcyber-backup` v1 remain browser-local. Backup files are not uploaded to an API route. Provider credentials are server-only; never commit `.env.local` or use public provider-key variables.
