"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Brand from "@/components/Brand";
import Citations from "@/components/Citations";
import DocumentUpload from "@/components/DocumentUpload";
import PipelineStatus, {
  PIPELINE_STEPS,
  PipelineStepId,
} from "@/components/PipelineStatus";
import {
  Citation,
  formatQueryError,
  postQuery,
  QueryApiError,
} from "@/lib/api";
import { getIdToken, getCurrentUsername, signOut } from "@/lib/auth";
import { documentFileName } from "@/lib/document";
import {
  getLastDocumentKey,
  setLastDocumentKey,
} from "@/lib/document-preference";

type ChatProps = {
  onUnauthorized: () => void;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  citations?: Citation[];
  documentUri?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const SUGGESTED_PROMPTS = [
  "What is this document about?",
  "Summarize the key points.",
  "Who or what is mentioned most often?",
];

const STEP_DELAYS_MS = [0, 350, 750, 1300, 2000, 2700];

export default function Chat({ onUnauthorized }: ChatProps) {
  const [documentKey, setDocumentKey] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<PipelineStepId | null>(null);
  const [lastCompletedAt, setLastCompletedAt] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentUsername = getCurrentUsername();
    setUsername(currentUsername);
    if (currentUsername) {
      setDocumentKey(getLastDocumentKey(currentUsername));
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) {
      setPipelineStep(null);
      return;
    }

    const timers = STEP_DELAYS_MS.map((delay, index) =>
      window.setTimeout(() => {
        setPipelineStep(PIPELINE_STEPS[index]?.id ?? null);
      }, delay),
    );

    return () => timers.forEach(clearTimeout);
  }, [loading]);

  async function sendQuery(query: string) {
    const key = documentKey.trim();
    if (!query || !key || loading) return;

    if (!API_URL) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "error",
          content: "NEXT_PUBLIC_API_URL is not configured.",
        },
      ]);
      return;
    }

    const idToken = await getIdToken();
    if (!idToken) {
      onUnauthorized();
      return;
    }

    const activeSessionId = sessionId ?? crypto.randomUUID();
    if (!sessionId) setSessionId(activeSessionId);

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: query },
    ]);
    setInput("");
    setLoading(true);
    setPipelineStep("auth");

    try {
      const data = await postQuery({
        apiUrl: API_URL,
        idToken,
        query,
        documentKey: key,
        sessionId: activeSessionId,
      });
      setPipelineStep("response");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          citations: data.citations ?? [],
          documentUri: data.documentUri,
        },
      ]);
      setLastCompletedAt(Date.now());
    } catch (err) {
      if (err instanceof QueryApiError && err.status === 401) {
        onUnauthorized();
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "error",
          content: formatQueryError(err),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    void sendQuery(input.trim());
  }

  function handleSignOut() {
    signOut();
    onUnauthorized();
  }

  const canSend =
    !loading && input.trim().length > 0 && documentKey.trim().length > 0;
  const activeDoc = documentFileName(documentKey);

  return (
    <div className="app-layout">
      <div className="chat-shell">
        <header className="chat-header">
          <Brand size="lg" tagline="Document intelligence" />
          <div className="header-actions">
            {username && (
              <span className="user-chip" title={username}>
                {username}
              </span>
            )}
            <button type="button" className="secondary" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <section className="document-card">
          <div className="document-card-top">
            <div className="document-card-label">
              <span className="doc-icon" aria-hidden>
                📄
              </span>
              Active document
            </div>
            <DocumentUpload
              disabled={loading}
              onUnauthorized={onUnauthorized}
              onReady={(processedKey) => {
                setDocumentKey(processedKey);
                if (username) {
                  setLastDocumentKey(username, processedKey);
                }
                setMessages([]);
                setSessionId(null);
              }}
            />
          </div>
          {documentKey ? (
            <div className="document-active-key">
              <code>{documentKey}</code>
            </div>
          ) : (
            <div className="document-active-key document-active-key-empty">
              No document selected
            </div>
          )}
          <p className="document-hint muted">
            {documentKey ? (
              <>
                Querying <strong>{activeDoc}</strong> via Bedrock Knowledge
                Base. A new upload will replace this selection.
              </>
            ) : (
              "Upload your first PDF to begin."
            )}
          </p>
        </section>

        <div className="message-list" role="log" aria-live="polite">
          {messages.length === 0 && !loading && (
            <div className="welcome-panel">
              <h2>
                {documentKey
                  ? "Ask Sheldon anything about your document"
                  : "Upload a PDF to get started"}
              </h2>
              <p className="muted">
                {documentKey
                  ? "Answers are grounded in vectors indexed from S3 through the ingestion pipeline into Bedrock Knowledge Base."
                  : "Sheldon will ingest, index, and prepare your document for grounded questions."}
              </p>
              {documentKey && (
                <div className="suggested-prompts">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="prompt-chip"
                      onClick={() => void sendQuery(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <article key={msg.id} className={`message message-${msg.role}`}>
              <div className="message-meta">
                {msg.role === "user" ? "You" : msg.role === "assistant" ? "Sheldon" : "Error"}
              </div>
              <div className="message-body">{msg.content}</div>
              {msg.role === "assistant" && msg.citations && (
                <Citations
                  citations={msg.citations}
                  documentUri={msg.documentUri}
                />
              )}
            </article>
          ))}

          {loading && (
            <article className="message message-assistant message-loading">
              <div className="message-meta">Sheldon</div>
              <div className="message-body typing">
                <span className="typing-dots">
                  <span />
                  <span />
                  <span />
                </span>
                Working through the pipeline…
              </div>
            </article>
          )}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={handleSend}>
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              documentKey
                ? `Ask about ${activeDoc}…`
                : "Upload a PDF before asking a question"
            }
            disabled={loading || !documentKey}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) handleSend(e as unknown as FormEvent);
              }
            }}
          />
          <button type="submit" disabled={!canSend}>
            {loading ? "Running…" : "Ask Sheldon"}
          </button>
        </form>
      </div>

      <PipelineStatus
        activeStep={pipelineStep}
        loading={loading}
        lastCompletedAt={lastCompletedAt}
      />
    </div>
  );
}
