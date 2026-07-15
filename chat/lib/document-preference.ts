"use client";

const STORAGE_PREFIX = "sheldon:last-document:";

function storageKey(username: string): string {
  return `${STORAGE_PREFIX}${username.trim().toLowerCase()}`;
}

export function getLastDocumentKey(username: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(storageKey(username)) ?? "";
}

export function setLastDocumentKey(
  username: string,
  documentKey: string,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(username), documentKey);
}
