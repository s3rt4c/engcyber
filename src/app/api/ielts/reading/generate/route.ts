import { NextRequest, NextResponse } from "next/server";
import { createIeltsReadingIdentity } from "@/server/ai/ielts";
import { parseIeltsReadingRequest } from "@/server/ai/ielts-request";
import { resolveAiRuntime } from "@/server/ai/runtime";

export async function POST(request: NextRequest) {
  try {
    const input = parseIeltsReadingRequest(await request.json());
    const identity = createIeltsReadingIdentity(input);
    const provider = resolveAiRuntime(process.env, "ielts_reading_generation");
    const generated = await provider.generateIeltsReading(input);
    return NextResponse.json({ questions: generated.questions, generationFingerprint: identity.generationFingerprint, provider: identity.provider, model: generated.model, source: { id: input.sourceId, fingerprint: input.sourceFingerprint, title: input.sourceTitle, url: input.sourceUrl } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "IELTS Reading practice could not be generated.";
    return NextResponse.json({ error: message }, { status: message.includes("configuration") || message.includes("Unsupported AI_PROVIDER") ? 503 : 422 });
  }
}
