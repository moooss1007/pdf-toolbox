export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "1 h 42 min" until `expiresAt`. */
export function timeLeft(expiresAt: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.ceil((expiresAt - now) / 60000));
  if (minutes >= 60) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `${minutes} min`;
}

export function pages(count: number | null): string {
  if (count === null) return "—";
  return count === 1 ? "1 page" : `${count} pages`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "That didn't work.";
}
