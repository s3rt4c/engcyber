import { apiError, apiJson } from "@/server/api-response";
import { createIeltsReadingIdentity } from "@/server/ai/ielts";
import { parseIeltsReadingRequest } from "@/server/ai/ielts-request";
import { readProtectedRouteJson } from "@/server/request-security";

export async function POST(request: Request) {
  try {
    const identity = createIeltsReadingIdentity(parseIeltsReadingRequest(await readProtectedRouteJson(request, "ieltsReadingIdentity")));
    return apiJson(identity);
  } catch (error) { return apiError(error, "Malformed request.", 400); }
}
