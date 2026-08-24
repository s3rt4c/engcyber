import { NextRequest, NextResponse } from "next/server";
import { resolveAiRuntime } from "@/server/ai/runtime";
import { parseWritingAnalysisRequest } from "@/server/ai/writing-request";
import { WritingAnalysisFailure } from "@/server/ai/writing-diagnostics";

export async function POST(request: NextRequest) {
  try {
    const input = parseWritingAnalysisRequest(await request.json());
    const provider = resolveAiRuntime(process.env, "writing_analysis");
    const generated = await provider.analyzeWriting(input);
    return NextResponse.json(generated);
  } catch (error) {
    if (error instanceof WritingAnalysisFailure) {
      return NextResponse.json({ error: error.message, ...(process.env.NODE_ENV !== "production" ? { diagnostic: error.diagnostic } : {}) }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Writing analysis failed.";
    const status = message.includes("require") || message.includes("Unsupported AI_PROVIDER") || message.includes("not configured") ? 503 : message.includes("sanitized") || message.includes("draft") || message.includes("request") || message.includes("feedback") ? 422 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
