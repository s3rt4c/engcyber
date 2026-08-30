import "server-only";

import { createHash, randomUUID } from "node:crypto";

export type AbuseCategory = "ai" | "manual_fetch" | "application_fetch";

export type TokenBucketPolicy = {
  readonly capacity: number;
  readonly tokensPerMinute: number;
};

export const abusePolicies: Record<AbuseCategory, TokenBucketPolicy> = {
  ai: { capacity: 3, tokensPerMinute: 6 },
  manual_fetch: { capacity: 2, tokensPerMinute: 3 },
  application_fetch: { capacity: 10, tokensPerMinute: 30 },
};

export const aiLeaseLimit = 2;
export const aiLeaseTtlMilliseconds = 90_000;

export type TokenBucketInput = {
  readonly category: AbuseCategory;
  readonly subjectHash: string;
  readonly policy: TokenBucketPolicy;
  readonly now: number;
};

export type TokenBucketResult = { readonly allowed: true } | { readonly allowed: false; readonly retryAfterSeconds: number };

export type AiLease = {
  readonly subjectHash: string;
  readonly leaseId: string;
  readonly expiresAt: number;
};

export interface AbuseStore {
  consumeToken(input: TokenBucketInput): Promise<TokenBucketResult>;
  acquireAiLease(input: AiLease): Promise<boolean>;
  releaseAiLease(lease: AiLease): Promise<void>;
}

export class AbuseControlError extends Error {
  constructor(readonly status: 429 | 503, readonly publicMessage: string, readonly retryAfterSeconds?: number) {
    super(publicMessage);
  }
}

export function opaqueSubjectHash(subject: string): string {
  return createHash("sha256").update(subject).digest("base64url");
}

export type AbuseControllerOptions = {
  readonly store: AbuseStore;
  readonly now?: () => number;
  readonly createLeaseId?: () => string;
};

/** Coordinates only opaque-subject policy state; it never receives learner content or provider data. */
export function createAbuseController(options: AbuseControllerOptions) {
  const now = options.now ?? Date.now;
  const createLeaseId = options.createLeaseId ?? randomUUID;
  return {
    async admit(subject: string, category: AbuseCategory): Promise<void> {
      const result = await options.store.consumeToken({ category, subjectHash: opaqueSubjectHash(subject), policy: abusePolicies[category], now: now() });
      if (!result.allowed) throw new AbuseControlError(429, "Too many requests. Try again shortly.", result.retryAfterSeconds);
    },
    async acquireAiLease(subject: string): Promise<AiLease> {
      const lease: AiLease = { subjectHash: opaqueSubjectHash(subject), leaseId: createLeaseId(), expiresAt: now() + aiLeaseTtlMilliseconds };
      if (!await options.store.acquireAiLease(lease)) throw new AbuseControlError(429, "Too many AI requests are already running. Try again shortly.");
      return lease;
    },
    async releaseAiLease(lease: AiLease): Promise<void> {
      await options.store.releaseAiLease(lease);
    },
  };
}

type BucketState = { tokens: number; updatedAt: number };

/** Deterministic test-only adapter. Production code must use the Upstash adapter. */
export function createInMemoryAbuseStore(): AbuseStore {
  const buckets = new Map<string, BucketState>();
  const leases = new Map<string, AiLease>();
  return {
    async consumeToken(input) {
      const key = `${input.category}:${input.subjectHash}`;
      const previous = buckets.get(key) ?? { tokens: input.policy.capacity, updatedAt: input.now };
      const elapsed = Math.max(0, input.now - previous.updatedAt);
      const refillPerMillisecond = input.policy.tokensPerMinute / 60_000;
      const tokens = Math.min(input.policy.capacity, previous.tokens + elapsed * refillPerMillisecond);
      if (tokens < 1) {
        buckets.set(key, { tokens, updatedAt: input.now });
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((1 - tokens) / refillPerMillisecond / 1_000)) };
      }
      buckets.set(key, { tokens: tokens - 1, updatedAt: input.now });
      return { allowed: true };
    },
    async acquireAiLease(lease) {
      for (const [key, active] of leases) if (active.expiresAt <= lease.expiresAt - aiLeaseTtlMilliseconds) leases.delete(key);
      const activeForSubject = [...leases.values()].filter((active) => active.subjectHash === lease.subjectHash).length;
      if (activeForSubject >= aiLeaseLimit) return false;
      leases.set(`${lease.subjectHash}:${lease.leaseId}`, lease);
      return true;
    },
    async releaseAiLease(lease) {
      leases.delete(`${lease.subjectHash}:${lease.leaseId}`);
    },
  };
}
