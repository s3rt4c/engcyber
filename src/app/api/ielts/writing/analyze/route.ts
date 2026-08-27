import { NextRequest, NextResponse } from "next/server";
import { parseIeltsWritingRequest } from "@/server/ai/ielts-request";
import { resolveAiRuntime } from "@/server/ai/runtime";

export async function POST(request: NextRequest) {
  try {
    const input = parseIeltsWritingRequest(await request.json());
    const provider = resolveAiRuntime(process.env, "ielts_writing_feedback");
    const generated = await provider.analyzeIeltsWriting(input);
    return NextResponse.json({ feedback: generated.feedback, model: generated.model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "IELTS Writing feedback could not be generated.";
    return NextResponse.json({ error: message }, { status: message.includes("configuration") || message.includes("Unsupported AI_PROVIDER") ? 503 : 422 });
  }
}
