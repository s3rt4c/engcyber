import "server-only";

import { AccessControlError, accessSubjectForRequest, readAccessConfiguration } from "@/server/access-control";
import { AbuseControlError, createAbuseController, createInMemoryAbuseStore, type AbuseCategory } from "@/server/abuse-control";
import { createUpstashAbuseStoreFromEnvironment } from "@/server/upstash-abuse-store";

type AbuseController = ReturnType<typeof createAbuseController>;

let testController: AbuseController | undefined;

/** Test-only injection point. Production selection never reads this value. */
export function setAbuseControllerForTests(controller: AbuseController | undefined): void {
  testController = controller;
}

function controllerForEnvironment(env: Record<string, string | undefined>): AbuseController {
  const access = readAccessConfiguration(env);
  if (access.mode === "local") return testController ?? createAbuseController({ store: createInMemoryAbuseStore() });
  if (access.mode !== "cloudflare") throw new AccessControlError(503, "Access verification is unavailable.");
  return createAbuseController({ store: createUpstashAbuseStoreFromEnvironment(env) });
}

async function admit(request: Request, category: AbuseCategory, env: Record<string, string | undefined>): Promise<{ readonly controller: AbuseController; readonly subject: string }> {
  try {
    const subject = accessSubjectForRequest(request, env);
    const controller = controllerForEnvironment(env);
    await controller.admit(subject, category);
    return { controller, subject };
  } catch (error) {
    if (error instanceof AccessControlError || error instanceof AbuseControlError) throw error;
    throw new AbuseControlError(503, "Request controls are temporarily unavailable.");
  }
}

/** Admits one learner action before provider work; internal provider retries remain inside one lease and token. */
export async function withAiAdmission<T>(request: Request, operation: () => Promise<T>, env: Record<string, string | undefined> = process.env): Promise<T> {
  const admitted = await admit(request, "ai", env);
  let lease;
  try {
    lease = await admitted.controller.acquireAiLease(admitted.subject);
    return await operation();
  } finally {
    if (lease) {
      try { await admitted.controller.releaseAiLease(lease); }
      catch { /* The expiring lease remains the crash-safe recovery boundary. */ }
    }
  }
}

/** Admits an external fetch after request validation and before upstream network work. */
export async function withFetchAdmission<T>(request: Request, category: Exclude<AbuseCategory, "ai">, operation: () => Promise<T>, env: Record<string, string | undefined> = process.env): Promise<T> {
  await admit(request, category, env);
  return await operation();
}
