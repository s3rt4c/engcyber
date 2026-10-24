import { selectWritingSessionForLesson, writingSessionSchema, type WritingSession } from "@/domain/writing";

const key = "engcyber.writing-sessions.v1";
const version = "m3-writing-sessions-v1";
const maximumSessions = 50;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Envelope = { version: typeof version; sessions: WritingSession[] };

function browserStorage(): StorageLike | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function parseEnvelope(value: string | null): Envelope | null {
  if (!value) return { version, sessions: [] };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const envelope = parsed as { version?: unknown; sessions?: unknown };
    if (envelope.version !== version || !Array.isArray(envelope.sessions)) return null;
    const sessions: WritingSession[] = [];
    for (const session of envelope.sessions) {
      const valid = writingSessionSchema.safeParse(session);
      if (!valid.success) return null;
      sessions.push(valid.data);
    }
    return { version, sessions };
  } catch { return null; }
}

export class LocalWritingSessionStore {
  constructor(private readonly storage: StorageLike | null) {}

  private read(): Envelope | null {
    if (!this.storage) return { version, sessions: [] };
    try {
      const envelope = parseEnvelope(this.storage.getItem(key));
      if (!envelope) this.storage.removeItem(key);
      return envelope;
    } catch { return null; }
  }

  private write(envelope: Envelope): boolean {
    if (!this.storage) return false;
    try { this.storage.setItem(key, JSON.stringify(envelope)); return true; } catch { return false; }
  }

  async list(): Promise<WritingSession[]> {
    return this.read()?.sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)) ?? [];
  }

  async getByLesson(lessonId: string): Promise<WritingSession | null> {
    return selectWritingSessionForLesson(await this.list(), lessonId);
  }

  async save(session: WritingSession): Promise<boolean> {
    const valid = writingSessionSchema.safeParse(session);
    if (!valid.success) return false;
    const envelope = this.read();
    if (!envelope) return false;
    const sessions = [...envelope.sessions.filter((entry) => entry.id !== valid.data.id), valid.data]
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)).slice(-maximumSessions);
    return this.write({ version, sessions });
  }
}

export function createBrowserWritingSessionStore(): LocalWritingSessionStore {
  return new LocalWritingSessionStore(browserStorage());
}
