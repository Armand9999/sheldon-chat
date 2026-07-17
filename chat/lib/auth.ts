"use client";

const STORAGE_KEY = "rag-chat-auth";

export type StoredAuth = {
  username: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type AuthApiPayload = {
  error?: string;
  code?: string;
  username?: string;
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  userConfirmed?: boolean;
  confirmed?: boolean;
  signedIn?: boolean;
  ok?: boolean;
};

function readStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

function writeStoredAuth(auth: StoredAuth | null): void {
  if (typeof window === "undefined") return;
  if (!auth) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function storeTokens(data: AuthApiPayload): void {
  if (!data.username || !data.idToken || !data.accessToken || !data.refreshToken) {
    throw new Error("Authentication response was incomplete.");
  }
  writeStoredAuth({
    username: data.username,
    idToken: data.idToken,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (data.expiresIn ?? 3600) * 1000,
  });
}

async function postAuthJson(
  path: string,
  body: Record<string, string>,
  crashLabel: string,
): Promise<{ res: Response; data: AuthApiPayload }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data: AuthApiPayload = {};
  try {
    data = raw ? (JSON.parse(raw) as AuthApiPayload) : {};
  } catch {
    throw Object.assign(
      new Error(
        raw.trim().startsWith("Internal Server Error")
          ? `${crashLabel} crashed on the server. Try again after the latest deploy finishes.`
          : raw.slice(0, 200) || `${crashLabel} failed.`,
      ),
      { code: "InternalServerError" },
    );
  }

  if (!res.ok) {
    throw Object.assign(new Error(data.error || `${crashLabel} failed.`), {
      code: data.code,
    });
  }

  return { res, data };
}

export function getCurrentUsername(): string | null {
  return readStoredAuth()?.username ?? null;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { data } = await postAuthJson(
    "/api/auth/sign-in",
    { email: email.trim(), password },
    "Sign-in",
  );
  storeTokens(data);
}

export async function signUp(
  email: string,
  password: string,
): Promise<{ userConfirmed: boolean }> {
  const { data } = await postAuthJson(
    "/api/auth/sign-up",
    { email: email.trim(), password },
    "Sign-up",
  );
  return { userConfirmed: Boolean(data.userConfirmed) };
}

export async function confirmSignUp(
  email: string,
  code: string,
  password?: string,
): Promise<{ signedIn: boolean }> {
  const body: Record<string, string> = {
    email: email.trim(),
    code: code.trim(),
  };
  if (password) body.password = password;

  const { data } = await postAuthJson("/api/auth/confirm", body, "Confirmation");
  if (data.signedIn) {
    storeTokens(data);
    return { signedIn: true };
  }
  return { signedIn: false };
}

export async function resendVerificationCode(email: string): Promise<void> {
  await postAuthJson(
    "/api/auth/resend-code",
    { email: email.trim() },
    "Resend code",
  );
}

export function signOut(): void {
  writeStoredAuth(null);
}

export function getSession(): Promise<StoredAuth | null> {
  const auth = readStoredAuth();
  if (!auth) return Promise.resolve(null);
  if (auth.expiresAt <= Date.now()) {
    writeStoredAuth(null);
    return Promise.resolve(null);
  }
  return Promise.resolve(auth);
}

export async function getIdToken(): Promise<string | null> {
  const auth = await getSession();
  return auth?.idToken ?? null;
}

export function cognitoErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Something went wrong.";
  const e = err as { code?: string; message?: string; name?: string };
  const code = e.code || e.name;
  switch (code) {
    case "NotAuthorizedException":
      return "Incorrect email or password.";
    case "UserNotConfirmedException":
      return "Account not confirmed. Enter the verification code from your email.";
    case "UserNotFoundException":
      return "No account found for that email.";
    case "UsernameExistsException":
      return "An account with that email already exists. Sign in instead.";
    case "InvalidPasswordException":
      return (
        e.message ||
        "Password does not meet Cognito requirements (length and character rules)."
      );
    case "CodeMismatchException":
      return "That verification code is incorrect.";
    case "ExpiredCodeException":
      return "That verification code has expired. Request a new one.";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Too many attempts. Try again later.";
    default:
      if (e.message?.includes("USER_PASSWORD_AUTH")) {
        return "Enable ALLOW_USER_PASSWORD_AUTH on your Cognito app client.";
      }
      return e.message || "Something went wrong.";
  }
}
