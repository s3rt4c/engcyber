import { apiError, apiJson } from "@/server/api-response";
import { createLessonIdentity, parseSanitizedLessonContent } from "@/server/lessons/request";
import { readProtectedRouteJson } from "@/server/request-security";

export async function POST(request: Request) {
  try {
    const body = await readProtectedRouteJson<{ content?: unknown }>(request, "lessonIdentity");
    const identity = createLessonIdentity(parseSanitizedLessonContent(body.content));
    return apiJson(identity);
  } catch (error) { return apiError(error, "Malformed request.", 400); }
}
