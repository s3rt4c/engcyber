# M17 Private Deployment Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the EngCyber repository ready for the selected Vercel-origin, Cloudflare Access, and Upstash Redis private-deployment architecture without activating any external deployment.

**Architecture:** A Next.js 16 `proxy.ts` verifies Cloudflare Access JWTs in required production mode and injects only a verified opaque subject into protected requests. Route handlers then use one server-side abuse-control boundary backed by atomic Upstash Redis token buckets and expiring AI leases; local/test mode uses explicitly injected deterministic adapters.

**Tech Stack:** Next.js 16 Node Proxy, `jose`, `@upstash/redis`, Vitest, existing Playwright.

**Spec:** User-approved M17 architecture brief, attachment `c79a2deb-e950-4ea0-8653-49532cc45639`.

## Global Constraints

- No custom EngCyber account, session, cookie, learner database, or learner persistence.
- Production Access mode fails closed when JWT/configuration/JWKS verification fails.
- Provider-cost and user-controlled-fetch routes fail closed with safe 503 when Redis control state is unavailable.
- AI capacity is shared across all six AI capabilities: burst 3, sustained 6 per 60 seconds, maximum two 90-second leases per verified subject.
- Manual URL import uses an independent burst-2, 3-per-60-second bucket; application-controlled fetch is burst-10, 30-per-60-second.
- Keep M16 transport, Origin, no-store, error, SSRF, provider retry, and browser-local backup boundaries intact.
- Do not commit, push, merge, create external configuration, or start M18.

---

### Task 1: Configuration and Access JWT Gate

**Files:**
- Create: `src/server/access-control.ts`, `src/server/access-control.test.ts`, `proxy.ts`, `proxy.test.ts`
- Modify: `.env.example`, `package.json`, `package-lock.json`

- [ ] **Step 1: Write failing access tests**

```ts
expect(await verifyCloudflareAccessJwt(validToken, configuration)).toEqual({ subject: "subject-a" });
expect(await verifyCloudflareAccessJwt(expiredToken, configuration)).toReject();
expect(await authorizeAccessRequest(noToken, requiredConfiguration)).toEqual({ allowed: false, status: 401 });
```

- [ ] **Step 2: Run focused tests and observe missing-module failure**

Run: `npm test -- src/server/access-control.test.ts proxy.test.ts`

- [ ] **Step 3: Implement minimal configuration, cached Remote JWKS verification, and Proxy header injection**

```ts
const headers = new Headers(request.headers);
headers.delete("x-engcyber-access-subject");
headers.set("x-engcyber-access-subject", verified.subject);
return NextResponse.next({ request: { headers } });
```

- [ ] **Step 4: Re-run focused tests**

Run: `npm test -- src/server/access-control.test.ts proxy.test.ts`

### Task 2: Atomic Abuse-Control Boundary

**Files:**
- Create: `src/server/abuse-control.ts`, `src/server/abuse-control.test.ts`, `src/server/upstash-abuse-store.ts`, `src/server/upstash-abuse-store.test.ts`

- [ ] **Step 1: Write failing token-bucket and lease tests**

```ts
expect(await controls.admit({ subject: "a", category: "ai" })).toMatchObject({ kind: "admitted" });
expect(await controls.admit({ subject: "a", category: "ai" })).toMatchObject({ kind: "rate_limited" });
expect(await controls.acquireAiLease("a")).toMatchObject({ kind: "concurrency_limited" });
```

- [ ] **Step 2: Run focused tests and observe missing-module failure**

Run: `npm test -- src/server/abuse-control.test.ts src/server/upstash-abuse-store.test.ts`

- [ ] **Step 3: Implement the injected store contract and Upstash Lua/EVAL adapter**

```ts
export interface AbuseStore {
  consumeToken(input: TokenBucketInput): Promise<TokenBucketResult>;
  acquireLease(input: LeaseInput): Promise<LeaseResult>;
  releaseLease(input: LeaseReleaseInput): Promise<void>;
}
```

- [ ] **Step 4: Re-run focused tests**

Run: `npm test -- src/server/abuse-control.test.ts src/server/upstash-abuse-store.test.ts`

### Task 3: Route Admission Integration

**Files:**
- Modify: all six AI generation/action routes, `src/app/api/content/from-url/route.ts`, and the three application-controlled GET fetch routes
- Test: `src/app/api/security-envelope.test.ts` plus focused route-admission tests

- [ ] **Step 1: Write failing route tests that prove invalid transport never consumes quota and Redis failure prevents provider/fetch work**

```ts
expect(providerWasCalled).toBe(false);
expect(response.status).toBe(503);
expect(response.headers.get("retry-after")).toBeNull();
```

- [ ] **Step 2: Run focused route tests and observe failure**

Run: `npm test -- src/app/api/security-envelope.test.ts`

- [ ] **Step 3: Wrap only validated provider/fetch operations in shared admission helpers and release AI leases in `finally`**

```ts
return await withAiAdmission(request, async () => {
  return await provider.generateLesson(content);
});
```

- [ ] **Step 4: Re-run focused route tests**

Run: `npm test -- src/app/api/security-envelope.test.ts`

### Task 4: Deployment Documentation and Regression Coverage

**Files:**
- Create: `DEPLOYMENT.md`
- Modify: `README.md`, `ROADMAP.md`, `DECISIONS.md`, `SECURITY.md`, `docs/ARCHITECTURE.md`, optional focused security E2E

- [ ] **Step 1: Write failing/document-contract tests where appropriate, then add only repository-ready wording**
- [ ] **Step 2: Document Cloudflare-to-Vercel topology, Access JWT bypass defense, Upstash-only control state, preview fail-closed policy, manual smoke checks, HSTS/CSP deferral, and external configuration pending status**
- [ ] **Step 3: Keep the browser suite at five tests unless a compact deterministic access test is necessary**

### Task 5: Full Verification and Scope Review

- [ ] **Step 1: Run `npm test`, lint, typegen, typecheck, build, E2E, audit, and `git diff --check`**
- [ ] **Step 2: Inspect staged/untracked scope without committing**
- [ ] **Step 3: Verify `.env.local` remains present, ignored, and untracked; no credentials, learner data, backups, reports, or M18 artifacts exist**
