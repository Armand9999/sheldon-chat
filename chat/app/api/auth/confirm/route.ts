import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();
    const code = String(body.code ?? "").trim();
    const password = String(body.password ?? "");

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required." },
        { status: 400 },
      );
    }

    const { confirmSignUpWithCode, signInWithPassword } = await import(
      "@/lib/cognito-server"
    );
    await confirmSignUpWithCode(email, code);

    if (password) {
      const tokens = await signInWithPassword(email, password);
      return NextResponse.json({
        confirmed: true,
        signedIn: true,
        username: email,
        ...tokens,
      });
    }

    return NextResponse.json({
      confirmed: true,
      signedIn: false,
      username: email,
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const code = e.code;
    const status =
      code === "CodeMismatchException" || code === "ExpiredCodeException"
        ? 400
        : code === "NotAuthorizedException" || code === "UserNotFoundException"
          ? 401
          : 500;

    return NextResponse.json(
      {
        error: e.message || "Confirmation failed.",
        code,
      },
      { status },
    );
  }
}
