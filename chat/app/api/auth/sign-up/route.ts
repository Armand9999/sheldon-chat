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

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const { signUpWithPassword } = await import("@/lib/cognito-server");
    const result = await signUpWithPassword(email, password);
    return NextResponse.json({
      ...result,
      username: email,
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const code = e.code;
    const status =
      code === "UsernameExistsException"
        ? 409
        : code === "InvalidPasswordException"
          ? 400
          : 500;

    return NextResponse.json(
      {
        error: e.message || "Sign-up failed.",
        code,
      },
      { status },
    );
  }
}
