"use client";

import { useCallback, useEffect, useState } from "react";
import Brand from "@/components/Brand";
import Chat from "@/components/Chat";
import LoginForm from "@/components/LoginForm";
import { getSession, signOut } from "@/lib/auth";

type AuthState = "loading" | "signedOut" | "signedIn";

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("loading");

  const refreshAuth = useCallback(async () => {
    try {
      const session = await getSession();
      setAuthState(session ? "signedIn" : "signedOut");
    } catch {
      setAuthState("signedOut");
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  function handleUnauthorized() {
    signOut();
    setAuthState("signedOut");
  }

  if (authState === "loading") {
    return (
      <main className="centered">
        <div className="loading-screen">
          <Brand size="lg" tagline="Document intelligence" />
          <p className="muted">Loading…</p>
        </div>
      </main>
    );
  }

  if (authState === "signedOut") {
    return (
      <main className="centered">
        <LoginForm onSuccess={() => setAuthState("signedIn")} />
      </main>
    );
  }

  return (
    <main className="centered wide">
      <Chat onUnauthorized={handleUnauthorized} />
    </main>
  );
}
