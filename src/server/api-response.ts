import "server-only";

import { NextResponse } from "next/server";

import { RequestSecurityError } from "@/server/request-security";

const noStoreHeaders = { "Cache-Control": "no-store" };

export function apiJson(value: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  for (const [name, content] of Object.entries(noStoreHeaders)) headers.set(name, content);
  return NextResponse.json(value, { ...init, headers });
}

export function apiError(error: unknown, fallback = "Something went wrong.", status = 500): NextResponse {
  if (error instanceof RequestSecurityError) return apiJson({ error: error.publicMessage }, { status: error.status });
  return apiJson({ error: fallback }, { status });
}
