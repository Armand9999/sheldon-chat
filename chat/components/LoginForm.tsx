"use client";

import { FormEvent, useState } from "react";
import Brand from "@/components/Brand";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";
import {
  cognitoErrorMessage,
  confirmSignUp,
  resendVerificationCode,
  signIn,
  signUp,
} from "@/lib/auth";

type LoginFormProps = {
  onSuccess: () => void;
};

type AuthMode = "signIn" | "signUp" | "confirm";

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setCode("");
    if (next === "signIn") setConfirmPassword("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "signIn") {
        try {
          await signIn(email, password);
          onSuccess();
        } catch (err) {
          const codeName = (err as { code?: string }).code;
          if (codeName === "UserNotConfirmedException") {
            setMode("confirm");
            setError(null);
            setInfo("Enter the verification code we emailed you.");
            return;
          }
          throw err;
        }
        return;
      }

      if (mode === "signUp") {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
        const result = await signUp(email, password);
        if (result.userConfirmed) {
          await signIn(email, password);
          onSuccess();
          return;
        }
        setInfo("Check your email for a verification code.");
        setMode("confirm");
        return;
      }

      const result = await confirmSignUp(email, code, password);
      if (result.signedIn) {
        onSuccess();
        return;
      }
      setInfo("Email verified. Sign in to continue.");
      switchMode("signIn");
    } catch (err) {
      setError(cognitoErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await resendVerificationCode(email);
      setInfo("A new verification code was sent to your email.");
    } catch (err) {
      setError(cognitoErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "signIn"
      ? "Sign in to Sheldon"
      : mode === "signUp"
        ? "Create your Sheldon account"
        : "Verify your email";

  const lead =
    mode === "signIn"
      ? "Sign in to query documents indexed through your ingestion pipeline."
      : mode === "signUp"
        ? "Create an account to upload documents and ask grounded questions."
        : `Enter the verification code sent to ${email || "your email"}.`;

  const canSubmit =
    mode === "confirm"
      ? Boolean(email && code && !loading)
      : mode === "signUp"
        ? Boolean(email && password && confirmPassword && !loading)
        : Boolean(email && password && !loading);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Brand size="lg" tagline="Document intelligence" />
        <p className="auth-lead muted">{lead}</p>

        <ArchitectureDiagram compact />

        {mode !== "confirm" && (
          <div className="auth-mode-toggle" role="tablist" aria-label="Auth mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signIn"}
              className={mode === "signIn" ? "active" : undefined}
              onClick={() => switchMode("signIn")}
              disabled={loading}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signUp"}
              className={mode === "signUp" ? "active" : undefined}
              onClick={() => switchMode("signUp")}
              disabled={loading}
            >
              Sign up
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || mode === "confirm"}
            />
          </label>

          {mode !== "confirm" && (
            <label>
              Password
              <input
                type="password"
                autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
              />
            </label>
          )}

          {mode === "signUp" && (
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
              />
            </label>
          )}

          {mode === "confirm" && (
            <label>
              Verification code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={loading}
              />
            </label>
          )}

          {info && <p className="auth-info">{info}</p>}
          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={!canSubmit}>
            {loading
              ? mode === "signIn"
                ? "Signing in…"
                : mode === "signUp"
                  ? "Creating account…"
                  : "Verifying…"
              : title}
          </button>
        </form>

        {mode === "confirm" && (
          <div className="auth-secondary">
            <button type="button" className="linkish" onClick={handleResend} disabled={loading || !email}>
              Resend code
            </button>
            <button
              type="button"
              className="linkish"
              onClick={() => switchMode("signIn")}
              disabled={loading}
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
