import type { ContentCategoryId } from "@/domain/learning";

export type SourceKind = "rss" | "atom" | "manual_url" | "manual_text" | "future_crawler";
export type ContentType = "article" | "podcast" | "transcript" | "write_up" | "document" | "manual";
export interface Source { id: string; name: string; kind: SourceKind; endpoint: string | null; enabled: boolean; }
export interface FeedItem { id: string; sourceId: string; title: string; canonicalUrl: string | null; publishedAt: Date | null; author: string | null; summary: string | null; primaryCategory: ContentCategoryId; tags: readonly string[]; contentType: ContentType; }
export interface ExtractedContent { feedItemId: string | null; title: string; canonicalUrl: string | null; publishedAt: Date | null; author: string | null; primaryCategory: ContentCategoryId; tags: readonly string[]; contentType: ContentType; rawText: string; externalInputTrust: "untrusted"; }
export interface Content { id: string; feedItemId: string | null; title: string; canonicalUrl: string | null; publishedAt: Date | null; author: string | null; primaryCategory: ContentCategoryId; tags: readonly string[]; contentType: ContentType; sanitizedText: string; contentFingerprint: string; sanitizationStatus: "sanitized"; }
export interface Lesson { id: string; contentId: string; createdAt: Date; learnerLevel: "B1" | "B2" | "C1"; generationFingerprint: string; status: "draft" | "ready" | "archived"; }
export interface LessonSentence { id: string; lessonId: string; originalText: string; simplifiedEnglish: string | null; turkishSupport: string | null; }
export interface Phrase { id: string; text: string; kind: "word" | "phrase" | "collocation" | "technical_collocation"; meaning: string | null; }
export interface ErrorPattern { id: string; patternKey: string; category: "grammar" | "vocabulary" | "coherence" | "fluency" | "technical_accuracy" | "reading_comprehension" | "listening_comprehension"; lifecycle: "new" | "needs_practice" | "improving" | "mastered" | "returned"; }
