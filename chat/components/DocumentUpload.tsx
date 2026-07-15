"use client";

import { useRef, useState } from "react";
import { getIdToken } from "@/lib/auth";
import {
  ingestionStatusLabel,
  pollUntilReady,
  uploadDocument,
  type IngestionStatusResponse,
} from "@/lib/upload";
import { documentFileName } from "@/lib/document";

type UploadPhase =
  | "idle"
  | "uploading"
  | "ingesting"
  | "ready"
  | "error";

type DocumentUploadProps = {
  disabled?: boolean;
  onReady: (processedKey: string) => void;
  onUnauthorized: () => void;
};

export default function DocumentUpload({
  disabled = false,
  onReady,
  onUnauthorized,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(file: File | null) {
    if (!file || disabled) return;

    setError(null);
    setFileName(file.name);
    setPhase("uploading");
    setStatusText("Uploading to S3…");

    try {
      const idToken = await getIdToken();
      if (!idToken) {
        onUnauthorized();
        return;
      }

      const uploaded = await uploadDocument(idToken, file);

      setPhase("ingesting");
      setStatusText("Upload complete — running ingestion pipeline…");

      const onStatus = (status: IngestionStatusResponse) => {
        setStatusText(ingestionStatusLabel(status.manifestStatus));
      };

      await pollUntilReady(idToken, uploaded.processedKey, uploaded.intakeKey, {
        onStatus,
      });

      setPhase("ready");
      setStatusText(`${documentFileName(uploaded.processedKey)} is ready.`);
      onReady(uploaded.processedKey);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  function handlePickFile() {
    inputRef.current?.click();
  }

  const busy = phase === "uploading" || phase === "ingesting";

  return (
    <div className="upload-panel">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="upload-input-hidden"
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          void handleFileChange(file);
          e.target.value = "";
        }}
      />

      <div className="upload-row">
        <button
          type="button"
          className="secondary upload-button"
          onClick={handlePickFile}
          disabled={disabled || busy}
        >
          {busy ? "Processing…" : "Upload PDF"}
        </button>
        {fileName && (
          <span className="upload-filename muted">{fileName}</span>
        )}
      </div>

      {statusText && (
        <p className={`upload-status upload-status-${phase}`}>{statusText}</p>
      )}

      {phase === "ingesting" && (
        <div className="upload-progress" aria-hidden>
          <div className="upload-progress-bar" />
        </div>
      )}

      {error && <p className="error upload-error">{error}</p>}
    </div>
  );
}
