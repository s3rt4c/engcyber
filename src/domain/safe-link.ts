/** Prevents locally persisted text from becoming an executable navigation target. */
export function safeExternalHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}
