import { apiError, apiJson } from "@/server/api-response";
import { createIeltsReadingIdentity } from "@/server/ai/ielts";
import { parseIeltsReadingRequest } from "@/server/ai/ielts-request";
import { resolveAiRuntime } from "@/server/ai/runtime";
import { withAiAdmission } from "@/server/abuse-runtime";
import { readProtectedRouteJson } from "@/server/request-security";

export async function POST(request: Request) {
  let input;
  try {
    input = parseIeltsReadingRequest(await readProtectedRouteJson(request, "ieltsReadingGenerate"));
  } catch (error) { return apiError(error, "Malformed request.", 400); }
  try {
    const identity = createIeltsReadingIdentity(input);
    const provider = resolveAiRuntime(process.env, "ielts_reading_generation");
    const generated = await withAiAdmission(request, async () => await provider.generateIeltsReading(input));
    return apiJson({ questions: generated.questions, generationFingerprint: identity.generationFingerprint, provider: identity.provider, model: generated.model, source: { id: input.sourceId, fingerprint: input.sourceFingerprint, title: input.sourceTitle, url: input.sourceUrl } });
  } catch (error) { return apiError(error, "The upstream service is temporarily unavailable.", 503); }
}
