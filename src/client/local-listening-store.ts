import { defaultListeningPlaybackRate, isSupportedListeningPlaybackRate, listeningAttemptSchema, listeningSessionSchema, maximumListeningEvents, maximumListeningSessions, shadowingEventSchema, type ListeningAttempt, type ListeningSession, type ShadowingEvent } from "@/domain/listening";

const key = "engcyber.listening.v1";
const version = "m5-listening-v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface ListeningSnapshot { readonly sessions: ListeningSession[]; readonly attempts: ListeningAttempt[]; readonly shadowingEvents: ShadowingEvent[]; readonly playbackRate: number; }
type Envelope = { version: typeof version; sessions: ListeningSession[]; attempts: ListeningAttempt[]; shadowingEvents: ShadowingEvent[]; playbackRate: number };

function browserStorage(): StorageLike | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function emptySnapshot(): ListeningSnapshot {
  return { sessions: [], attempts: [], shadowingEvents: [], playbackRate: defaultListeningPlaybackRate };
}

function validatedSessions(values: readonly unknown[]): ListeningSession[] | null {
  const sessions: ListeningSession[] = [];
  for (const value of values) { const parsed = listeningSessionSchema.safeParse(value); if (!parsed.success) return null; sessions.push(parsed.data); }
  return sessions;
}

function validatedAttempts(values: readonly unknown[]): ListeningAttempt[] | null {
  const attempts: ListeningAttempt[] = [];
  for (const value of values) { const parsed = listeningAttemptSchema.safeParse(value); if (!parsed.success) return null; attempts.push(parsed.data); }
  return attempts;
}

function validatedShadowingEvents(values: readonly unknown[]): ShadowingEvent[] | null {
  const events: ShadowingEvent[] = [];
  for (const value of values) { const parsed = shadowingEventSchema.safeParse(value); if (!parsed.success) return null; events.push(parsed.data); }
  return events;
}

function parseEnvelope(value: string | null): Envelope | null {
  if (!value) return { version, ...emptySnapshot() };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const envelope = parsed as Partial<Envelope>;
    if (envelope.version !== version || !Array.isArray(envelope.sessions) || !Array.isArray(envelope.attempts) || !Array.isArray(envelope.shadowingEvents)) return null;
    const sessions = validatedSessions(envelope.sessions);
    const attempts = validatedAttempts(envelope.attempts);
    const shadowingEvents = validatedShadowingEvents(envelope.shadowingEvents);
    if (!sessions || !attempts || !shadowingEvents) return null;
    return { version, sessions, attempts, shadowingEvents, playbackRate: isSupportedListeningPlaybackRate(envelope.playbackRate) ? envelope.playbackRate : defaultListeningPlaybackRate };
  } catch { return null; }
}

function compact(snapshot: ListeningSnapshot): ListeningSnapshot | null {
  if (!isSupportedListeningPlaybackRate(snapshot.playbackRate)) return null;
  const sessions = validatedSessions(snapshot.sessions);
  const attempts = validatedAttempts(snapshot.attempts);
  const shadowingEvents = validatedShadowingEvents(snapshot.shadowingEvents);
  if (!sessions || !attempts || !shadowingEvents) return null;
  const newestSessions = sessions.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id)).slice(-maximumListeningSessions);
  if (new Set(newestSessions.map((session) => session.id)).size !== newestSessions.length) return null;
  const exerciseIds = new Set(newestSessions.flatMap((session) => session.exercises.map((exercise) => exercise.id)));
  const events = [
    ...attempts.map((value) => ({ kind: "attempt" as const, value, at: value.attemptedAt })),
    ...shadowingEvents.map((value) => ({ kind: "shadow" as const, value, at: value.repeatedAt })),
  ].filter((event) => exerciseIds.has(event.value.exerciseId)).sort((left, right) => left.at.localeCompare(right.at) || left.value.id.localeCompare(right.value.id)).slice(-maximumListeningEvents);
  return { sessions: newestSessions, attempts: events.filter((event) => event.kind === "attempt").map((event) => event.value as ListeningAttempt), shadowingEvents: events.filter((event) => event.kind === "shadow").map((event) => event.value as ShadowingEvent), playbackRate: snapshot.playbackRate };
}

export class LocalListeningStore {
  constructor(private readonly storage: StorageLike | null) {}

  async snapshot(): Promise<ListeningSnapshot> {
    if (!this.storage) return emptySnapshot();
    try {
      const envelope = parseEnvelope(this.storage.getItem(key));
      if (!envelope) { this.storage.removeItem(key); return emptySnapshot(); }
      return { sessions: envelope.sessions, attempts: envelope.attempts, shadowingEvents: envelope.shadowingEvents, playbackRate: envelope.playbackRate };
    } catch { return emptySnapshot(); }
  }

  async save(snapshot: ListeningSnapshot): Promise<boolean> {
    if (!this.storage) return false;
    const bounded = compact(snapshot);
    if (!bounded) return false;
    try { this.storage.setItem(key, JSON.stringify({ version, ...bounded })); return true; } catch { return false; }
  }
}

export function createBrowserListeningStore(): LocalListeningStore {
  return new LocalListeningStore(browserStorage());
}
