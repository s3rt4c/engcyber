import type { PhraseStore, SavedPhrase } from "@/domain/boundaries";

const KEY = "engcyber.saved-phrases.v1";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isSavedPhrase(value: unknown): value is SavedPhrase {
  if (!value || typeof value !== "object") return false;
  const phrase = value as Record<string, unknown>;
  return typeof phrase.phrase === "string" && typeof phrase.context === "string" && typeof phrase.sourceTitle === "string" && (typeof phrase.sourceUrl === "string" || phrase.sourceUrl === null) && (typeof phrase.contentId === "string" || phrase.contentId === null) && typeof phrase.savedAt === "string";
}

function browserStorage(): StorageLike | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export class LocalPhraseStore implements PhraseStore {
  constructor(private readonly storage: StorageLike | null) {}

  async save(phrase: SavedPhrase): Promise<"saved" | "duplicate" | "unavailable"> {
    if (!this.storage) return "unavailable";
    try {
      let existing: SavedPhrase[];
      try {
        const parsed: unknown = JSON.parse(this.storage.getItem(KEY) ?? "[]");
        if (!Array.isArray(parsed)) throw new Error("Saved phrase data is malformed");
        existing = parsed.filter(isSavedPhrase);
      } catch {
        this.storage.removeItem(KEY);
        existing = [];
      }
      const duplicate = existing.some((item) => item.phrase.trim().toLocaleLowerCase() === phrase.phrase.trim().toLocaleLowerCase() && item.sourceUrl === phrase.sourceUrl && item.context.trim() === phrase.context.trim());
      if (duplicate) return "duplicate";
      this.storage.setItem(KEY, JSON.stringify([...existing, phrase]));
      return "saved";
    } catch {
      return "unavailable";
    }
  }
}

export function createBrowserPhraseStore(): PhraseStore {
  return new LocalPhraseStore(browserStorage());
}
