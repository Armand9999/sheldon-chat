import { NextResponse } from "next/server";
import { isAuthError, requireBearerToken } from "@/lib/auth-server";

export async function GET(request: Request) {
  const token = requireBearerToken(request);
  if (isAuthError(token)) return token;

  const { searchParams } = new URL(request.url);
  const processedKey = searchParams.get("processedKey")?.trim();
  const intakeKey = searchParams.get("intakeKey")?.trim();

  if (!processedKey || !intakeKey) {
    return NextResponse.json(
      { error: "processedKey and intakeKey are required." },
      { status: 400 },
    );
  }

  try {
    const { getIngestionStatus } = await import("@/lib/s3-server");
    const status = await getIngestionStatus(processedKey, intakeKey);
    return NextResponse.json(status);
  } catch (err) {
    const e = err as { message?: string; name?: string; Code?: string };
    console.error("upload_status_error", err);
    return NextResponse.json(
      {
        error: e.message || "Failed to check ingestion status.",
        code: e.name || e.Code,
      },
      { status: 500 },
    );
  }
}
