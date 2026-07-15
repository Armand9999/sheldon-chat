export type Citation = {
  source: string;
  excerpt: string;
  score?: number | null;
};

export type QueryResponse = {
  answer: string;
  citations: Citation[];
  sessionId?: string | null;
  documentUri?: string;
};

export type QueryErrorBody = {
  error: string;
  hint?: string;
  limit?: number;
  resetAt?: string;
  documentUri?: string;
};

export class QueryApiError extends Error {
  status: number;
  body: QueryErrorBody;

  constructor(status: number, body: QueryErrorBody) {
    super(body.error || `Request failed (${status})`);
    this.name = "QueryApiError";
    this.status = status;
    this.body = body;
  }
}

type PostQueryParams = {
  apiUrl: string;
  idToken: string;
  query: string;
  documentKey: string;
  sessionId?: string;
};

export async function postQuery({
  apiUrl,
  idToken,
  query,
  documentKey,
  sessionId,
}: PostQueryParams): Promise<QueryResponse> {
  const base = apiUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      query,
      documentKey,
      ...(sessionId ? { sessionId } : {}),
    }),
  });

  let body: QueryResponse | QueryErrorBody;
  try {
    body = await res.json();
  } catch {
    throw new QueryApiError(res.status, {
      error: `Invalid response (${res.status})`,
    });
  }

  if (!res.ok) {
    throw new QueryApiError(res.status, body as QueryErrorBody);
  }

  return body as QueryResponse;
}

export function formatQueryError(err: unknown): string {
  if (err instanceof QueryApiError) {
    const { status, body } = err;
    if (status === 401) {
      return "Session expired or unauthorized. Please sign in again.";
    }
    if (status === 429) {
      const reset = body.resetAt ? ` Resets at ${body.resetAt} (UTC).` : "";
      return `Daily query limit exceeded.${reset}`;
    }
    if (status === 404) {
      return [body.error, body.documentUri, body.hint].filter(Boolean).join(" — ");
    }
    if (status === 503) {
      return body.error || "Service temporarily unavailable. Retry later.";
    }
    return [body.error, body.hint].filter(Boolean).join(" — ") || err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
