import { storedLessonSchema, type StoredLesson } from "@/domain/lesson";
import type { LessonStore } from "@/domain/boundaries";

const key = "engcyber.lessons.v1";
const cacheVersion = "m2-lesson-cache-v1";
const maximumLessons = 20;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type LessonEnvelope = { version: typeof cacheVersion; lessons: StoredLesson[] };

function browserStorage(): StorageLike | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function parseEnvelope(value: string | null): LessonEnvelope | null {
  if (!value) return { version: cacheVersion, lessons: [] };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const envelope = parsed as { version?: unknown; lessons?: unknown };
    if (envelope.version !== cacheVersion || !Array.isArray(envelope.lessons)) return null;
    const lessons: StoredLesson[] = [];
    for (const lesson of envelope.lessons) {
      const validated = storedLessonSchema.safeParse(lesson);
      if (!validated.success) return null;
      lessons.push(validated.data);
    }
    return { version: cacheVersion, lessons };
  } catch { return null; }
}

export class LocalLessonStore implements LessonStore {
  constructor(private readonly storage: StorageLike | null, private readonly now = () => new Date().toISOString()) {}

  private read(): LessonEnvelope | null {
    if (!this.storage) return { version: cacheVersion, lessons: [] };
    try {
      const parsed = parseEnvelope(this.storage.getItem(key));
      if (!parsed) this.storage.removeItem(key);
      return parsed;
    } catch { return null; }
  }

  private write(envelope: LessonEnvelope): boolean {
    if (!this.storage) return false;
    try { this.storage.setItem(key, JSON.stringify(envelope)); return true; } catch { return false; }
  }

  async get(generationFingerprint: string): Promise<StoredLesson | null> {
    const envelope = this.read();
    if (!envelope) return null;
    const found = envelope.lessons.find((lesson) => lesson.generationFingerprint === generationFingerprint);
    if (!found) return null;
    const updated = { ...found, lastAccessedAt: this.now() };
    this.write({ version: cacheVersion, lessons: envelope.lessons.map((lesson) => lesson.generationFingerprint === generationFingerprint ? updated : lesson) });
    return updated;
  }

  async save(lesson: StoredLesson): Promise<boolean> {
    const valid = storedLessonSchema.safeParse(lesson);
    if (!valid.success) return false;
    const envelope = this.read();
    if (!envelope) return false;
    const withoutCurrent = envelope.lessons.filter((entry) => entry.generationFingerprint !== lesson.generationFingerprint);
    const lessons = [...withoutCurrent, valid.data].sort((left, right) => left.lastAccessedAt.localeCompare(right.lastAccessedAt)).slice(-maximumLessons);
    return this.write({ version: cacheVersion, lessons });
  }
}

export function createBrowserLessonStore(): LocalLessonStore {
  return new LocalLessonStore(browserStorage());
}

export type { StoredLesson };
