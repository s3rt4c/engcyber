import "server-only";

export interface RetryAttempt {
  readonly attempt: number;
}

export interface RetryResult<T> {
  readonly value: T;
  readonly attempt: number;
}

export interface TransientRetryOptions {
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly random?: () => number;
}

const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);
const transientNetworkCodes = new Set(["ECONNABORTED", "ECONNREFUSED", "ECONNRESET", "ENETDOWN", "ENETUNREACH", "ETIMEDOUT"]);
const maximumAttempts = 3;
export const aiAttemptTimeoutMilliseconds = 20_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function numericStatus(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

/** Reads documented provider status fields without parsing provider message text. */
export function aiProviderStatus(error: unknown): number | undefined {
  const record = asRecord(error);
  if (!record) return undefined;
  const nested = asRecord(record.error);
  return numericStatus(record.status)
    ?? numericStatus(record.statusCode)
    ?? numericStatus(record.code)
    ?? numericStatus(nested?.status)
    ?? numericStatus(nested?.code);
}

function networkCode(error: unknown): string | undefined {
  const record = asRecord(error);
  const code = record?.code;
  if (typeof code === "string") return code;
  const cause = asRecord(record?.cause);
  return typeof cause?.code === "string" ? cause.code : undefined;
}

export function isTransientAiProviderFailure(error: unknown): boolean {
  const status = aiProviderStatus(error);
  if (status !== undefined) return transientStatuses.has(status);
  const code = networkCode(error);
  if (code && transientNetworkCodes.has(code)) return true;
  return error instanceof TypeError && /(?:fetch|network)/iu.test(error.message);
}

function defaultWait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Converts a stalled provider operation into the existing retry-classified ETIMEDOUT failure. */
export async function withAiAttemptTimeout<T>(operation: Promise<T>, milliseconds = aiAttemptTimeoutMilliseconds, wait: (milliseconds: number) => Promise<void> = defaultWait): Promise<T> {
  const timeout = wait(milliseconds).then(() => Promise.reject(Object.assign(new Error("AI provider request timed out."), { code: "ETIMEDOUT" })));
  return Promise.race([operation, timeout]);
}

function retryDelayMilliseconds(retryNumber: number, random: () => number): number {
  const base = 1_000 * 2 ** (retryNumber - 1);
  const jitter = 0.8 + (Math.min(1, Math.max(0, random())) * 0.4);
  return Math.round(base * jitter);
}

/** Runs a single provider operation at most three times for classified transient failures. */
export async function retryTransientAiOperation<T>(operation: (attempt: RetryAttempt) => Promise<T>, options: TransientRetryOptions = {}): Promise<RetryResult<T>> {
  const wait = options.wait ?? defaultWait;
  const random = options.random ?? Math.random;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      return { value: await operation({ attempt }), attempt };
    } catch (error) {
      if (attempt === maximumAttempts || !isTransientAiProviderFailure(error)) throw error;
      await wait(retryDelayMilliseconds(attempt, random));
    }
  }
  throw new Error("Transient retry operation completed without a result.");
}
