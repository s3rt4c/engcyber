import { NextResponse, type NextRequest } from "next/server";

import { accessRequestHeaders, authorizeAccessRequest } from "@/server/access-control";

function deniedResponse(status: 401 | 503, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** M17 origin-bypass gate: Cloudflare Access JWTs are verified before pages and APIs reach Next routes. */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const authorization = await authorizeAccessRequest(request);
  if (authorization.kind === "denied") return deniedResponse(authorization.status, authorization.publicMessage);
  return NextResponse.next({ request: { headers: accessRequestHeaders(request.headers, authorization) } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
