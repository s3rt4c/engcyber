import "server-only";

import { Redis } from "@upstash/redis";

import { aiLeaseLimit, aiLeaseTtlMilliseconds, type AbuseStore, type AiLease, type TokenBucketInput, type TokenBucketResult } from "@/server/abuse-control";

type RedisAbuseClient = {
  eval<T>(script: string, keys: string[], args: string[]): Promise<T>;
  zrem(key: string, ...members: string[]): Promise<number>;
};

const consumeTokenScript = `
local current = redis.call('TIME')
local now = tonumber(current[1]) * 1000 + math.floor(tonumber(current[2]) / 1000)
local capacity = tonumber(ARGV[1])
local perMinute = tonumber(ARGV[2])
local stored = redis.call('HMGET', KEYS[1], 'tokens', 'updatedAt')
local tokens = tonumber(stored[1]) or capacity
local updatedAt = tonumber(stored[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - updatedAt) * perMinute / 60000)
local ttl = math.ceil(capacity * 60000 / perMinute + 60000)
if tokens < 1 then
  redis.call('HMSET', KEYS[1], 'tokens', tokens, 'updatedAt', now)
  redis.call('PEXPIRE', KEYS[1], ttl)
  return { 0, math.max(1, math.ceil((1 - tokens) * 60 / perMinute)) }
end
redis.call('HMSET', KEYS[1], 'tokens', tokens - 1, 'updatedAt', now)
redis.call('PEXPIRE', KEYS[1], ttl)
return { 1, 0 }
`;

const acquireLeaseScript = `
local current = redis.call('TIME')
local now = tonumber(current[1]) * 1000 + math.floor(tonumber(current[2]) / 1000)
local ttl = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if redis.call('ZCARD', KEYS[1]) >= ${aiLeaseLimit} then return 0 end
redis.call('ZADD', KEYS[1], now + ttl, ARGV[1])
redis.call('PEXPIRE', KEYS[1], ttl)
return 1
`;

function bucketKey(input: TokenBucketInput): string {
  return `engcyber:m17:bucket:${input.category}:${input.subjectHash}`;
}

function leaseKey(subjectHash: string): string {
  return `engcyber:m17:ai-leases:${subjectHash}`;
}

function asTuple(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((part) => typeof part === "number")) throw new Error("Invalid Upstash token bucket response.");
  return [value[0], value[1]];
}

/** Uses Redis-side TIME and Lua scripts so each quota/lease decision is cross-instance atomic. */
export function createUpstashAbuseStore(redis: RedisAbuseClient): AbuseStore {
  return {
    async consumeToken(input): Promise<TokenBucketResult> {
      const [allowed, retryAfterSeconds] = asTuple(await redis.eval<unknown>(consumeTokenScript, [bucketKey(input)], [String(input.policy.capacity), String(input.policy.tokensPerMinute)]));
      if (allowed === 1) return { allowed: true };
      if (allowed === 0 && Number.isInteger(retryAfterSeconds) && retryAfterSeconds > 0) return { allowed: false, retryAfterSeconds };
      throw new Error("Invalid Upstash token bucket decision.");
    },
    async acquireAiLease(lease: AiLease): Promise<boolean> {
      const result = await redis.eval<unknown>(acquireLeaseScript, [leaseKey(lease.subjectHash)], [lease.leaseId, String(aiLeaseTtlMilliseconds)]);
      if (result === 1) return true;
      if (result === 0) return false;
      throw new Error("Invalid Upstash lease decision.");
    },
    async releaseAiLease(lease: AiLease): Promise<void> {
      await redis.zrem(leaseKey(lease.subjectHash), lease.leaseId);
    },
  };
}

export function createUpstashAbuseStoreFromEnvironment(env: Record<string, string | undefined> = process.env): AbuseStore {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("Upstash abuse-control configuration is unavailable.");
  return createUpstashAbuseStore(new Redis({ url, token }));
}
