import { reviewEventSchema, reviewItemSchema, type ReviewEvent, type ReviewItem } from "@/domain/review";

const key = "engcyber.review-items.v1";
const version = "m4-review-store-v1";
const maximumItems = 100;
const maximumEvents = 500;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Envelope = { version: typeof version; items: ReviewItem[]; events: ReviewEvent[] };

function browserStorage(): StorageLike | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function empty(): Envelope { return { version, items: [], events: [] }; }

function parseEnvelope(value: string | null): Envelope | null {
  if (!value) return empty();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const envelope = parsed as { version?: unknown; items?: unknown; events?: unknown };
    if (envelope.version !== version || !Array.isArray(envelope.items) || !Array.isArray(envelope.events)) return null;
    const items: ReviewItem[] = [];
    const events: ReviewEvent[] = [];
    for (const item of envelope.items) {
      const valid = reviewItemSchema.safeParse(item);
      if (!valid.success) return null;
      items.push(valid.data);
    }
    for (const event of envelope.events) {
      const valid = reviewEventSchema.safeParse(event);
      if (!valid.success) return null;
      events.push(valid.data);
    }
    return { version, items, events };
  } catch { return null; }
}

export interface ReviewSnapshot { readonly items: readonly ReviewItem[]; readonly events: readonly ReviewEvent[]; }

export class LocalReviewStore {
  constructor(private readonly storage: StorageLike | null) {}

  private read(): Envelope | null {
    if (!this.storage) return empty();
    try {
      const envelope = parseEnvelope(this.storage.getItem(key));
      if (!envelope) this.storage.removeItem(key);
      return envelope;
    } catch { return null; }
  }

  async snapshot(): Promise<ReviewSnapshot> {
    const envelope = this.read();
    return envelope ? { items: envelope.items, events: envelope.events } : { items: [], events: [] };
  }

  async save(items: readonly ReviewItem[], events: readonly ReviewEvent[]): Promise<boolean> {
    if (!this.storage || items.length > maximumItems) return false;
    const uniqueKeys = new Set(items.map((item) => `${item.sourceType}:${item.patternKey}`));
    if (uniqueKeys.size !== items.length) return false;
    const validItems: ReviewItem[] = [];
    for (const item of items) {
      const valid = reviewItemSchema.safeParse(item);
      if (!valid.success) return false;
      validItems.push(valid.data);
    }
    const validEvents: ReviewEvent[] = [];
    for (const event of events) {
      const valid = reviewEventSchema.safeParse(event);
      if (!valid.success) return false;
      validEvents.push(valid.data);
    }
    const retainedEvents = validEvents.sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt) || left.id.localeCompare(right.id)).slice(-maximumEvents);
    try {
      this.storage.setItem(key, JSON.stringify({ version, items: validItems, events: retainedEvents }));
      return true;
    } catch { return false; }
  }
}

export function createBrowserReviewStore(): LocalReviewStore {
  return new LocalReviewStore(browserStorage());
}
