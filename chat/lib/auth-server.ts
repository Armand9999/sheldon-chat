import { NextResponse } from "next/server";

export function requireBearerToken(request: Request): string | NextResponse {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return match[1];
}

export function isAuthError(result: string | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
