import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const { signInWithPassword } = await import("@/lib/cognito-server");
    const tokens = await signInWithPassword(email, password);
    return NextResponse.json({
      ...tokens,
      username: email,
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const code = e.code;
    const status =
      code === "UserNotConfirmedException"
        ? 403
        : code === "UserNotFoundException" || code === "NotAuthorizedException"
          ? 401
          : 500;

    return NextResponse.json(
      {
        error: e.message || "Sign-in failed.",
        code,
      },
      { status },
    );
  }
}
