import { ieltsReadingPracticeSchema, ieltsWritingSessionSchema, type IeltsReadingPractice, type IeltsWritingSession } from "@/domain/ielts";
import { ieltsListeningSessionSchema, type IeltsListeningSession } from "@/domain/ielts-listening";

const key = "engcyber.ielts-practice.v1";
const version = "m12-ielts-practice-v2";
const maximumReading = 30;
const maximumWriting = 30;
const maximumListening = 30;
type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Envelope = { version: typeof version; reading: IeltsReadingPractice[]; writing: IeltsWritingSession[]; listening: IeltsListeningSession[] };
type LegacyEnvelope = { version: "m11-ielts-practice-v1"; reading: IeltsReadingPractice[]; writing: IeltsWritingSession[] };

function empty(): Envelope { return { version, reading: [], writing: [], listening: [] }; }
function parse(value: string | null): Envelope | null {
  if (!value) return empty();
  try {
    const candidate = JSON.parse(value) as Partial<Envelope | LegacyEnvelope>;
    if ((candidate.version !== version && candidate.version !== "m11-ielts-practice-v1") || !Array.isArray(candidate.reading) || !Array.isArray(candidate.writing)) return null;
    const reading = candidate.reading.map((item) => ieltsReadingPracticeSchema.safeParse(item));
    const writing = candidate.writing.map((item) => ieltsWritingSessionSchema.safeParse(item));
    const listeningValues = candidate.version === version && Array.isArray(candidate.listening) ? candidate.listening : [];
    const listening = listeningValues.map((item) => ieltsListeningSessionSchema.safeParse(item));
    if (reading.some((item) => !item.success) || writing.some((item) => !item.success) || listening.some((item) => !item.success)) return null;
    return { version, reading: reading.map((item) => item.data!), writing: writing.map((item) => item.data!), listening: listening.map((item) => item.data!) };
  } catch { return null; }
}
function browserStorage(): StorageLike | null { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } }
function newest<T extends { id: string; updatedAt: string }>(items: readonly T[], maximum: number) { return [...items].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id)).slice(-maximum); }

export class LocalIeltsPracticeStore {
  constructor(private readonly storage: StorageLike | null) {}
  private read() { try { return this.storage ? parse(this.storage.getItem(key)) : null; } catch { return null; } }
  private write(value: Envelope) { try { this.storage?.setItem(key, JSON.stringify(value)); return Boolean(this.storage); } catch { return false; } }
  async listReading() { return (this.read()?.reading ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async getReading(id: string) { return (await this.listReading()).find((item) => item.id === id) ?? null; }
  async getReadingByFingerprint(generationFingerprint: string) { return (await this.listReading()).find((item) => item.generationFingerprint === generationFingerprint) ?? null; }
  async saveReading(item: IeltsReadingPractice) { const valid = ieltsReadingPracticeSchema.safeParse(item); const current = this.read(); if (!valid.success || !current) return false; return this.write({ ...current, reading: newest([...current.reading.filter((entry) => entry.id !== item.id), valid.data], maximumReading) }); }
  async listWriting() { return (this.read()?.writing ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async getWriting(id: string) { return (await this.listWriting()).find((item) => item.id === id) ?? null; }
  async saveWriting(item: IeltsWritingSession) { const valid = ieltsWritingSessionSchema.safeParse(item); const current = this.read(); if (!valid.success || !current) return false; return this.write({ ...current, writing: newest([...current.writing.filter((entry) => entry.id !== item.id), valid.data], maximumWriting) }); }
  async listListening() { return (this.read()?.listening ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id)); }
  async getListening(id: string) { return (await this.listListening()).find((item) => item.id === id) ?? null; }
  async saveListening(item: IeltsListeningSession) { const valid = ieltsListeningSessionSchema.safeParse(item); const current = this.read(); if (!valid.success || !current) return false; return this.write({ ...current, listening: newest([...current.listening.filter((entry) => entry.id !== item.id), valid.data], maximumListening) }); }
}
export function createBrowserIeltsPracticeStore() { return new LocalIeltsPracticeStore(browserStorage()); }
