export type UploadResult = {
  intakeKey: string;
  processedKey: string;
  documentId: string;
  contentType: string;
  fileName: string;
  size: number;
};

export type IngestionStatusResponse = {
  processedKey: string;
  intakeKey: string;
  documentId: string;
  manifestStatus: string | null;
  processedExists: boolean;
  ready: boolean;
  error: string | null;
};

export async function uploadDocument(
  idToken: string,
  file: File,
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);

  let res: Response;
  try {
    res = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      body: form,
    });
  } catch {
    throw new Error("Could not reach the upload API.");
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to upload file.");
  }
  return data as UploadResult;
}

export async function fetchIngestionStatus(
  idToken: string,
  processedKey: string,
  intakeKey: string,
): Promise<IngestionStatusResponse> {
  const params = new URLSearchParams({ processedKey, intakeKey });
  const res = await fetch(`/api/upload/status?${params}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to check ingestion status.");
  }
  return data as IngestionStatusResponse;
}

export async function pollUntilReady(
  idToken: string,
  processedKey: string,
  intakeKey: string,
  options?: {
    intervalMs?: number;
    timeoutMs?: number;
    onStatus?: (status: IngestionStatusResponse) => void;
  },
): Promise<IngestionStatusResponse> {
  const intervalMs = options?.intervalMs ?? 3000;
  const timeoutMs = options?.timeoutMs ?? 5 * 60 * 1000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const status = await fetchIngestionStatus(idToken, processedKey, intakeKey);
    options?.onStatus?.(status);

    if (status.ready) return status;
    if (status.manifestStatus === "FAILED") {
      throw new Error(status.error || "Ingestion failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Ingestion is taking longer than expected. Try again shortly.");
}

export function ingestionStatusLabel(status: string | null): string {
  switch (status) {
    case "QUEUED":
      return "Queued for ingestion";
    case "INGESTING":
      return "Indexing into Knowledge Base";
    case "COMPLETE":
      return "Ready to query";
    case "FAILED":
      return "Ingestion failed";
    default:
      return "Waiting for pipeline";
  }
}
