import { NextRequest, NextResponse } from "next/server";
import { createLessonIdentity, parseSanitizedLessonContent } from "@/server/lessons/request";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { content?: unknown };
    const identity = createLessonIdentity(parseSanitizedLessonContent(body.content));
    return NextResponse.json(identity);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lesson identity failed.";
    return NextResponse.json({ error: message }, { status: message.includes("not configured") ? 503 : 422 });
  }
}
