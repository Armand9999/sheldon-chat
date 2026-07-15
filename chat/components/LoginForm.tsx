"use client";

import { FormEvent, useState } from "react";
import Brand from "@/components/Brand";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";
import { cognitoErrorMessage, signIn } from "@/lib/auth";

type LoginFormProps = {
  onSuccess: () => void;
};

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      onSuccess();
    } catch (err) {
      setError(cognitoErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Brand size="lg" tagline="Document intelligence" />
        <p className="auth-lead muted">
          Sign in to query documents indexed through your ingestion pipeline.
        </p>

        <ArchitectureDiagram compact />

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading || !email || !password}>
            {loading ? "Signing in…" : "Sign in to Sheldon"}
          </button>
        </form>
      </div>
    </div>
  );
}
