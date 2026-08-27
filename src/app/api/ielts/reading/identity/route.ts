import { NextRequest, NextResponse } from "next/server";
import { createIeltsReadingIdentity } from "@/server/ai/ielts";
import { parseIeltsReadingRequest } from "@/server/ai/ielts-request";

export async function POST(request: NextRequest) {
  try {
    const identity = createIeltsReadingIdentity(parseIeltsReadingRequest(await request.json()));
    return NextResponse.json(identity);
  } catch (error) {
    const message = error instanceof Error ? error.message : "IELTS Reading identity failed.";
    return NextResponse.json({ error: message }, { status: message.includes("configuration") || message.includes("Unsupported AI_PROVIDER") ? 503 : 422 });
  }
}
