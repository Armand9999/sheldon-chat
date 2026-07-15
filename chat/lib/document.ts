export function documentFileName(keyOrUri: string): string {
  const value = keyOrUri.trim();
  if (!value) return "Unknown document";

  const withoutScheme = value.replace(/^s3:\/\/[^/]+\//, "");
  const parts = withoutScheme.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? value;
}

export function documentKeyFromUri(uri: string): string {
  const match = uri.match(/^s3:\/\/[^/]+\/(.+)$/);
  return match?.[1] ?? uri;
}

export function relevanceLabel(score: number | null | undefined): string {
  if (typeof score !== "number") return "—";
  if (score >= 0.8) return "High";
  if (score >= 0.6) return "Medium";
  return "Low";
}

export function relevancePercent(score: number | null | undefined): number {
  if (typeof score !== "number") return 0;
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}
