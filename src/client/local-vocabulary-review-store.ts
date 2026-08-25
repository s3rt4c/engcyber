import type { VocabularyReviewStore } from "@/domain/boundaries";
import {
  vocabularyReviewEventSchema,
  vocabularyReviewItemSchema,
  type VocabularyReviewEvent,
  type VocabularyReviewItem,
} from "@/domain/vocabulary-review";

const key = "engcyber.vocabulary-review.v1";
const version = "m10-vocabulary-review-v1";
const maximumItems = 200;
const maximumEvents = 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Envelope = { readonly version: typeof version; readonly items: readonly VocabularyReviewItem[]; readonly events: readonly VocabularyReviewEvent[] };

export interface VocabularyReviewSnapshot {
  readonly items: readonly VocabularyReviewItem[];
  readonly events: readonly VocabularyReviewEvent[];
}

function empty(): Envelope {
  return { version, items: [], events: [] };
}

function parseEnvelope(value: string | null): Envelope | null {
  if (!value) {
    return empty();
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const candidate = parsed as { version?: unknown; items?: unknown; events?: unknown };
    if (candidate.version !== version || !Array.isArray(candidate.items) || !Array.isArray(candidate.events)) {
      return null;
    }

    const items = candidate.items.map((item) => vocabularyReviewItemSchema.safeParse(item));
    const events = candidate.events.map((event) => vocabularyReviewEventSchema.safeParse(event));
    if (items.some((item) => !item.success) || events.some((event) => !event.success)) {
      return null;
    }

    return {
      version,
      items: items.map((item) => item.data!),
      events: events.map((event) => event.data!),
    };
  } catch {
    return null;
  }
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function validateItems(items: readonly VocabularyReviewItem[]): VocabularyReviewItem[] | null {
  if (items.length > maximumItems || new Set(items.map((item) => item.phraseId)).size !== items.length) {
    return null;
  }

  const parsed = items.map((item) => vocabularyReviewItemSchema.safeParse(item));
  return parsed.some((item) => !item.success) ? null : parsed.map((item) => item.data!);
}

function retainEvents(events: readonly VocabularyReviewEvent[]): VocabularyReviewEvent[] | null {
  const parsed = events.map((event) => vocabularyReviewEventSchema.safeParse(event));
  if (parsed.some((event) => !event.success)) {
    return null;
  }

  return parsed
    .map((event) => event.data!)
    .sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt) || left.id.localeCompare(right.id))
    .slice(-maximumEvents);
}

export class LocalVocabularyReviewStore implements VocabularyReviewStore {
  constructor(private readonly storage: StorageLike | null) {}

  private read(): Envelope | null {
    if (!this.storage) {
      return null;
    }

    try {
      return parseEnvelope(this.storage.getItem(key));
    } catch {
      return null;
    }
  }

  private write(envelope: Envelope): boolean {
    if (!this.storage) {
      return false;
    }

    try {
      this.storage.setItem(key, JSON.stringify(envelope));
      return true;
    } catch {
      return false;
    }
  }

  async snapshot(): Promise<VocabularyReviewSnapshot> {
    const envelope = this.read();
    return envelope ? { items: envelope.items, events: envelope.events } : { items: [], events: [] };
  }

  async save(items: readonly VocabularyReviewItem[], events: readonly VocabularyReviewEvent[]): Promise<boolean> {
    if (!this.read()) {
      return false;
    }

    const validItems = validateItems(items);
    const retainedEvents = retainEvents(events);
    if (!validItems || !retainedEvents) {
      return false;
    }

    return this.write({ version, items: validItems, events: retainedEvents });
  }

  async removePhrase(phraseId: string): Promise<"removed" | "not_found" | "unavailable"> {
    if (!phraseId.trim()) {
      return "unavailable";
    }

    const envelope = this.read();
    if (!envelope) {
      return "unavailable";
    }

    const items = envelope.items.filter((item) => item.phraseId !== phraseId);
    const events = envelope.events.filter((event) => event.phraseId !== phraseId);
    if (items.length === envelope.items.length && events.length === envelope.events.length) {
      return "not_found";
    }

    return this.write({ version, items, events }) ? "removed" : "unavailable";
  }
}

export function createBrowserVocabularyReviewStore(): VocabularyReviewStore {
  return new LocalVocabularyReviewStore(browserStorage());
}
