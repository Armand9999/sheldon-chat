"use client";

const STORAGE_KEY = "rag-chat-auth";

export type StoredAuth = {
  username: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
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

export function getCurrentUsername(): string | null {
  return readStoredAuth()?.username ?? null;
}

export async function signIn(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/sign-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const raw = await res.text();
  let data: {
    error?: string;
    code?: string;
    username?: string;
    idToken?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  } = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw Object.assign(
      new Error(
        raw.trim().startsWith("Internal Server Error")
          ? "Sign-in API crashed on the server. Try again after the latest deploy finishes."
          : raw.slice(0, 200) || "Sign-in failed.",
      ),
      { code: "InternalServerError" },
    );
  }

  if (!res.ok) {
    throw Object.assign(new Error(data.error || "Sign-in failed."), {
      code: data.code,
    });
  }

  if (!data.username || !data.idToken || !data.accessToken || !data.refreshToken) {
    throw new Error("Sign-in response was incomplete.");
  }

  writeStoredAuth({
    username: data.username,
    idToken: data.idToken,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (data.expiresIn ?? 3600) * 1000,
  });
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
  if (!err || typeof err !== "object") return "Sign-in failed.";
  const e = err as { code?: string; message?: string; name?: string };
  const code = e.code || e.name;
  switch (code) {
    case "NotAuthorizedException":
      return "Incorrect email or password.";
    case "UserNotConfirmedException":
      return "Account not confirmed. Check your email for a verification code.";
    case "UserNotFoundException":
      return "No account found for that email.";
    case "TooManyRequestsException":
      return "Too many attempts. Try again later.";
    default:
      if (e.message?.includes("USER_PASSWORD_AUTH")) {
        return "Enable ALLOW_USER_PASSWORD_AUTH on your Cognito app client.";
      }
      return e.message || "Sign-in failed.";
  }
}
