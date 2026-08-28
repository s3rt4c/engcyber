import { describe, expect, it } from "vitest";

import { RequestSecurityError, postJsonByteLimits, readProtectedJson } from "@/server/request-security";

const localEnvironment = { NODE_ENV: "test" };

function request(body: BodyInit | null, headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3000/api/example", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      origin: "http://127.0.0.1:3000",
      ...headers,
    },
    body,
    duplex: "half",
  } as RequestInit);
}

async function failure(input: Request, maximumBytes = 32): Promise<RequestSecurityError> {
  try {
    await readProtectedJson(input, { maximumBytes, env: localEnvironment });
    throw new Error("Expected request security failure.");
  } catch (error) {
    expect(error).toBeInstanceOf(RequestSecurityError);
    return error as RequestSecurityError;
  }
}

describe("readProtectedJson", () => {
  it("defines the approved route-specific transport caps", () => {
    expect(postJsonByteLimits).toEqual({ actions: 16_384, reviewEvaluation: 16_384, contentFromUrl: 8_192, contentFromText: 262_144, lessonIdentity: 131_072, lessonGenerate: 131_072, writingAnalyze: 65_536, ieltsReadingIdentity: 131_072, ieltsReadingGenerate: 131_072, ieltsWritingAnalyze: 65_536 });
  });

  it("accepts JSON with a charset and exact local origin", async () => {
    await expect(readProtectedJson<{ value: string }>(request('{"value":"ok"}'), { maximumBytes: 32, env: localEnvironment })).resolves.toEqual({ value: "ok" });
  });

  it("rejects an advertised oversized body before parsing", async () => {
    const result = await failure(request('{"value":"ok"}', { "content-length": "33" }));
    expect(result).toMatchObject({ status: 413, publicMessage: "Request is too large." });
  });

  it("counts streamed UTF-8 bytes rather than JavaScript characters", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"value":"🙂🙂🙂🙂🙂"}'));
        controller.close();
      },
    });
    const result = await failure(request(body, { "content-length": "" }), 24);
    expect(result).toMatchObject({ status: 413, publicMessage: "Request is too large." });
  });

  it("rejects malformed JSON without exposing parser details", async () => {
    const result = await failure(request('{not-json}'));
    expect(result).toMatchObject({ status: 400, publicMessage: "Malformed request." });
  });

  it("rejects an unsupported media type before reading JSON", async () => {
    const result = await failure(request("plain text", { "content-type": "text/plain" }));
    expect(result).toMatchObject({ status: 415, publicMessage: "This endpoint requires JSON." });
  });

  it("rejects missing, malformed, and cross-origin browser requests", async () => {
    await expect(failure(request("{}", { origin: "" }))).resolves.toMatchObject({ status: 403 });
    await expect(failure(request("{}", { origin: "not a url" }))).resolves.toMatchObject({ status: 403 });
    await expect(failure(request("{}", { origin: "https://other.example" }))).resolves.toMatchObject({ status: 403 });
    await expect(failure(request("{}", { "sec-fetch-site": "cross-site" }))).resolves.toMatchObject({ status: 403 });
  });

  it("requires an explicit valid canonical origin in production", async () => {
    await expect(readProtectedJson(request("{}"), { maximumBytes: 32, env: { NODE_ENV: "production" } })).rejects.toMatchObject({ status: 403 });
    const productionRequest = request("{}", { origin: "https://engcyber.example" });
    await expect(readProtectedJson(productionRequest, { maximumBytes: 32, env: { NODE_ENV: "production", ENGCYBER_APP_ORIGIN: "https://engcyber.example" } })).resolves.toEqual({});
  });
});
