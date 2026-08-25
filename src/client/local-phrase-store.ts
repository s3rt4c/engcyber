import type { PhraseStore, SavedPhrase, SavedPhraseInput } from "@/domain/boundaries";

const KEY = "engcyber.saved-phrases.v1";
const version = "m9-phrases-v2";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type LegacyPhrase = SavedPhraseInput;
type Envelope = { readonly version: typeof version; readonly phrases: readonly SavedPhrase[] };

function isPhraseInput(value: unknown): value is LegacyPhrase {
  if (!value || typeof value !== "object") return false;
  const phrase = value as Record<string, unknown>;
  return typeof phrase.phrase === "string" && typeof phrase.context === "string" && typeof phrase.sourceTitle === "string" && (typeof phrase.sourceUrl === "string" || phrase.sourceUrl === null) && (typeof phrase.contentId === "string" || phrase.contentId === null) && typeof phrase.savedAt === "string";
}

function isSavedPhrase(value: unknown): value is SavedPhrase {
  if (!isPhraseInput(value)) return false;
  const id = (value as Record<string, unknown>).id;
  return typeof id === "string" && id.trim().length > 0;
}

function duplicateKey(phrase: SavedPhraseInput): string {
  return `${phrase.phrase.trim().toLocaleLowerCase()}\u0000${phrase.sourceUrl ?? ""}\u0000${phrase.context.trim()}`;
}

function ordered(phrases: readonly SavedPhrase[]): SavedPhrase[] {
  return [...phrases].sort((left, right) => right.savedAt.localeCompare(left.savedAt) || right.id.localeCompare(left.id));
}

function browserStorage(): StorageLike | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export class LocalPhraseStore implements PhraseStore {
  constructor(private readonly storage: StorageLike | null, private readonly createId = () => {
    const cryptoApi = typeof globalThis.crypto === "undefined" ? null : globalThis.crypto;
    return typeof cryptoApi?.randomUUID === "function" ? cryptoApi.randomUUID() : `phrase-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }) {}

  private parse(raw: string | null): { readonly envelope: Envelope; readonly migrated: boolean } | null {
    if (!raw) return { envelope: { version, phrases: [] }, migrated: false };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const phrases = parsed.filter(isPhraseInput).map((phrase) => ({ ...phrase, id: this.createId() }));
        return { envelope: { version, phrases }, migrated: true };
      }
      if (!parsed || typeof parsed !== "object") return null;
      const candidate = parsed as { version?: unknown; phrases?: unknown };
      if (candidate.version !== version || !Array.isArray(candidate.phrases) || !candidate.phrases.every(isSavedPhrase)) return null;
      return { envelope: { version, phrases: candidate.phrases }, migrated: false };
    } catch { return null; }
  }

  private write(envelope: Envelope): boolean {
    if (!this.storage) return false;
    try { this.storage.setItem(KEY, JSON.stringify({ version, phrases: envelope.phrases })); return true; } catch { return false; }
  }

  private read(): { readonly envelope: Envelope; readonly migrated: boolean } | null {
    if (!this.storage) return null;
    try {
      const parsed = this.parse(this.storage.getItem(KEY));
      if (parsed) return parsed;
      this.storage.removeItem(KEY);
      return { envelope: { version, phrases: [] }, migrated: false };
    } catch { return null; }
  }

  async list(): Promise<readonly SavedPhrase[]> {
    const parsed = this.read();
    if (!parsed) return [];
    if (parsed.migrated && !this.write(parsed.envelope)) return ordered(parsed.envelope.phrases);
    return ordered(parsed.envelope.phrases);
  }

  async save(phrase: SavedPhraseInput): Promise<"saved" | "duplicate" | "unavailable"> {
    const parsed = this.read();
    if (!parsed || !isPhraseInput(phrase)) return "unavailable";
    if (parsed.envelope.phrases.some((item) => duplicateKey(item) === duplicateKey(phrase))) return "duplicate";
    const next: SavedPhrase = { ...phrase, id: this.createId() };
    return this.write({ version, phrases: [...parsed.envelope.phrases, next] }) ? "saved" : "unavailable";
  }

  async delete(id: string): Promise<"deleted" | "not_found" | "unavailable"> {
    const parsed = this.read();
    if (!parsed || !id.trim()) return "unavailable";
    const remaining = parsed.envelope.phrases.filter((phrase) => phrase.id !== id);
    if (remaining.length === parsed.envelope.phrases.length) return "not_found";
    return this.write({ version, phrases: remaining }) ? "deleted" : "unavailable";
  }
}

export function createBrowserPhraseStore(): PhraseStore {
  return new LocalPhraseStore(browserStorage());
}
