import { LocalErrorMemoryStore } from "@/client/local-error-memory-store";
import { LocalIeltsPracticeStore } from "@/client/local-ielts-practice-store";
import { LocalLessonStore } from "@/client/local-lesson-store";
import { LocalListeningStore } from "@/client/local-listening-store";
import { LocalPhraseStore } from "@/client/local-phrase-store";
import { LocalReviewStore } from "@/client/local-review-store";
import { LocalVocabularyReviewStore } from "@/client/local-vocabulary-review-store";
import { LocalWritingSessionStore } from "@/client/local-writing-session-store";
import type { LocalLearningReaders } from "@/client/local-learning-loaders";

/** Reuse store validation while preventing even malformed-record cleanup on Home. */
export function createReadOnlyHomeReaders(storage: Pick<Storage, "getItem"> | null): LocalLearningReaders {
  const readOnly = storage ? { getItem: (key: string) => storage.getItem(key), setItem: () => {}, removeItem: () => {} } : null;
  return {
    lessonStore: new LocalLessonStore(readOnly),
    phraseStore: new LocalPhraseStore(readOnly),
    writingSessionStore: new LocalWritingSessionStore(readOnly),
    errorMemoryStore: new LocalErrorMemoryStore(readOnly),
    reviewStore: new LocalReviewStore(readOnly),
    vocabularyReviewStore: new LocalVocabularyReviewStore(readOnly),
    listeningStore: new LocalListeningStore(readOnly),
    ieltsPracticeStore: new LocalIeltsPracticeStore(readOnly),
  };
}

export function createBrowserHomeReaders(): LocalLearningReaders {
  try { return createReadOnlyHomeReaders(window.localStorage); }
  catch { return createReadOnlyHomeReaders(null); }
}
