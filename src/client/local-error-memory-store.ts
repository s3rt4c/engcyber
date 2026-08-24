import { errorMemoryConfidenceMinimum, errorOccurrenceSchema, personalErrorPatternSchema, rebuildErrorPatterns, type ErrorOccurrence, type PersonalErrorPattern } from "@/domain/writing";

const key = "engcyber.error-memory.v1";
const version = "m3-error-memory-v1";
const maximumOccurrences = 200;
const maximumPatterns = 100;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Envelope = { version: typeof version; occurrences: ErrorOccurrence[]; patterns: PersonalErrorPattern[] };

function browserStorage(): StorageLike | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function parseEnvelope(value: string | null): Envelope | null {
  if (!value) return { version, occurrences: [], patterns: [] };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const envelope = parsed as { version?: unknown; occurrences?: unknown; patterns?: unknown };
    if (envelope.version !== version || !Array.isArray(envelope.occurrences) || !Array.isArray(envelope.patterns)) return null;
    const occurrences: ErrorOccurrence[] = [];
    const patterns: PersonalErrorPattern[] = [];
    for (const occurrence of envelope.occurrences) {
      const valid = errorOccurrenceSchema.safeParse(occurrence);
      if (!valid.success) return null;
      occurrences.push(valid.data);
    }
    for (const pattern of envelope.patterns) {
      const valid = personalErrorPatternSchema.safeParse(pattern);
      if (!valid.success) return null;
      patterns.push(valid.data);
    }
    return { version, occurrences, patterns };
  } catch { return null; }
}

export interface ErrorMemorySnapshot { readonly occurrences: readonly ErrorOccurrence[]; readonly patterns: readonly PersonalErrorPattern[]; }

export class LocalErrorMemoryStore {
  constructor(private readonly storage: StorageLike | null, private readonly now = () => new Date().toISOString()) {}

  private read(): Envelope | null {
    if (!this.storage) return { version, occurrences: [], patterns: [] };
    try {
      const envelope = parseEnvelope(this.storage.getItem(key));
      if (!envelope) this.storage.removeItem(key);
      return envelope;
    } catch { return null; }
  }

  private write(occurrences: readonly ErrorOccurrence[], previousPatterns: readonly PersonalErrorPattern[]): boolean {
    if (!this.storage) return false;
    const retained = [...occurrences].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).slice(-maximumOccurrences);
    const patterns = rebuildErrorPatterns(retained, previousPatterns, this.now()).slice(0, maximumPatterns);
    try { this.storage.setItem(key, JSON.stringify({ version, occurrences: retained, patterns })); return true; } catch { return false; }
  }

  async snapshot(): Promise<ErrorMemorySnapshot> {
    const envelope = this.read();
    return envelope ? { occurrences: envelope.occurrences, patterns: envelope.patterns } : { occurrences: [], patterns: [] };
  }

  async record(occurrence: ErrorOccurrence): Promise<boolean> {
    const valid = errorOccurrenceSchema.safeParse(occurrence);
    if (!valid.success || valid.data.dismissed || valid.data.confidence < errorMemoryConfidenceMinimum) return false;
    const envelope = this.read();
    if (!envelope) return false;
    return this.write([...envelope.occurrences.filter((entry) => entry.id !== valid.data.id), valid.data], envelope.patterns);
  }

  async markCorrected(ids: readonly string[], correctedAt = this.now()): Promise<boolean> {
    const envelope = this.read();
    if (!envelope) return false;
    const known = new Set(ids);
    if (!known.size) return true;
    return this.write(envelope.occurrences.map((occurrence) => known.has(occurrence.id) && !occurrence.dismissed ? { ...occurrence, correctedAt } : occurrence), envelope.patterns);
  }

  async setReviewStatus(patternKey: string, status: "mastered" | "needs_practice"): Promise<boolean> {
    const envelope = this.read();
    if (!envelope || !envelope.patterns.some((pattern) => pattern.patternKey === patternKey)) return false;
    const previousPatterns = envelope.patterns.map((pattern) => pattern.patternKey === patternKey ? { ...pattern, reviewStatus: status, reviewStatusUpdatedAt: this.now() } : pattern);
    return this.write(envelope.occurrences, previousPatterns);
  }

  async dismiss(id: string): Promise<boolean> {
    const envelope = this.read();
    if (!envelope) return false;
    if (!envelope.occurrences.some((occurrence) => occurrence.id === id)) return false;
    return this.write(envelope.occurrences.map((occurrence) => occurrence.id === id ? { ...occurrence, dismissed: true } : occurrence), envelope.patterns);
  }
}

export function createBrowserErrorMemoryStore(): LocalErrorMemoryStore {
  return new LocalErrorMemoryStore(browserStorage());
}
