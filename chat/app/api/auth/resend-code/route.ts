import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const { resendConfirmationCode } = await import("@/lib/cognito-server");
    await resendConfirmationCode(email);
    return NextResponse.json({ ok: true, username: email });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const code = e.code;
    const status =
      code === "UserNotFoundException"
        ? 404
        : code === "LimitExceededException" || code === "TooManyRequestsException"
          ? 429
          : 500;

    return NextResponse.json(
      {
        error: e.message || "Could not resend verification code.",
        code,
      },
      { status },
    );
  }
}
