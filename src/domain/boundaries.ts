import type { Content, ErrorPattern, ExtractedContent, FeedItem, LessonSentence, Source } from "@/domain/models";
import type { GeneratedLesson, StoredLesson } from "@/domain/lesson";
import type { LearnerProfile } from "@/domain/learner-profile";
import type { LearningSupportLevel } from "@/domain/learning";
import type { ErrorOccurrence, PersonalErrorPattern, WritingSession } from "@/domain/writing";

export interface SourceAdapter { readonly source: Source; discover(): Promise<readonly FeedItem[]>; }
export interface ContentExtractor { extract(input: { url?: string; rawText?: string }): Promise<ExtractedContent>; }
export interface ContentSanitizer { sanitize(input: ExtractedContent): Promise<Content>; }
export interface LessonGenerator { generate(input: { content: Content; learnerProfile: LearnerProfile; }): Promise<GeneratedLesson>; }
export interface SentenceActionService { act(input: { sentence: LessonSentence; action: "simplify" | "explain" | "translate" | "listen" | "grammar" | "save_phrase" | "ask_ai"; supportLevel: LearningSupportLevel; }): Promise<void>; }
export interface SavedPhrase { phrase: string; context: string; sourceTitle: string; sourceUrl: string | null; contentId: string | null; savedAt: string; }
export interface PhraseStore { save(phrase: SavedPhrase): Promise<"saved" | "duplicate" | "unavailable">; }
export interface LessonStore { get(generationFingerprint: string): Promise<StoredLesson | null>; save(lesson: StoredLesson): Promise<boolean>; }
export interface WritingSessionStore { list(): Promise<readonly WritingSession[]>; getByLesson(lessonId: string): Promise<WritingSession | null>; save(session: WritingSession): Promise<boolean>; }
export interface ErrorMemoryStore { snapshot(): Promise<{ readonly occurrences: readonly ErrorOccurrence[]; readonly patterns: readonly PersonalErrorPattern[] }>; record(occurrence: ErrorOccurrence): Promise<boolean>; markCorrected(ids: readonly string[], correctedAt?: string): Promise<boolean>; dismiss(id: string): Promise<boolean>; }
export interface ErrorTracker { record(pattern: ErrorPattern, context: string): Promise<void>; }
export interface BrowserTts { speak(text: string, rate?: number): void; stop(): void; }
