import "server-only";

import { aiAttemptTimeoutMilliseconds } from "@/server/ai/retry";

/** Keeps one OpenAI SDK attempt bounded; EngCyber owns the outer three-attempt retry policy. */
export function openAiClientOptions(apiKey: string) {
  return { apiKey, timeout: aiAttemptTimeoutMilliseconds, maxRetries: 0 };
}
