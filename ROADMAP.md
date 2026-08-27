# Roadmap

## M0 — Foundation

Accepted: Next.js application shell, typed domain model, source/lesson/error/TTS boundaries, environment contract, documentation, and test baseline.

## M1 — Discover & Reading

Accepted: manual URL/text intake; CISA and Hugging Face RSS discovery; safe extraction/sanitisation; authentic reading; explicit sentence help; browser TTS; and temporary browser-local phrase persistence. No automatic lesson generation or Supabase persistence.

## M2 — AI Lesson Engine

Accepted: explicit server-side structured lesson generation around sanitised content; local lesson cache; objective reading checks; and external ChatGPT Voice / writing prompts.

## M3 — Writing & Error Memory

Accepted: explicit two-attempt writing analysis, concise priority feedback, stable application-derived personal error patterns, false-positive dismissal, and browser-local writing/error-memory persistence. Voice-session ingestion remains later work.

## M4 — Error Pattern Review & Spaced Repetition

Accepted: Personal Error Memory patterns only; deterministic review scheduling, correction/free-production practice, and mastery or returned-error reactivation. Saved phrase SRS, vocabulary SRS, and phrase flashcards are deferred to a later milestone.

## M5 — Listening

Accepted: deterministic listening sessions from saved lesson text, browser-only TTS, local dictation alignment/scoring, and unscored shadowing. No speech recognition, paid TTS, listening SRS, podcast ingestion, or provider calls are part of M5.

## M6 — Source Expansion

Accepted: a curated four-source RSS/Atom metadata registry; safe bounded feed fetching and canonical normalisation; source health, provenance, URL deduplication, and local category/source/sort filtering. Arbitrary RSS subscriptions, persistent source preferences, full-article prefetching, and general crawling remain out of scope.

## M7 — Podcasts / Transcripts

Accepted: one curated Darknet Diaries RSS source; explicit native publisher-audio playback; explicit official transcript discovery/extraction; deterministic speaker-aware study passages; and selected-passage reuse of the existing explicit lesson engine. No transcript archive, audio download, transcript sync, transcription, provider change, or M8 work.

## M8 — Progress & Learning Analytics

Accepted: browser-local, deterministic analytics derived from existing lesson, writing, Error Memory, review, and listening evidence. It presents activity and learning evidence only—never IELTS/CEFR prediction, a proficiency score, gamification, cloud analytics, telemetry, or provider-generated coaching.

## M9 — Daily Learning Hub & Local Library

Accepted: a compact shared shell; Home/Daily Learning Hub; `/discover` plus canonical `/add-content`; `/library` for saved lessons and phrases; and zero-network cached lesson detail. New lessons retain only the exact bounded sanitized generation source needed to resume local lesson/writing work. Phrase records gain durable local IDs while their M1 duplicate signature remains unchanged.

## M10 — Phrase & Vocabulary SRS

Accepted, awaiting merge: explicitly enrolled saved phrases only; dedicated `VocabularyReviewStore`; deterministic 1/3/7/14/30/60-day retrieval progression; context-cloze/source-recall exercises; conservative local exact matching; returned-error recovery; and metadata-only events. It deliberately remains separate from M4 Error Pattern Review, uses no AI or network calls, and adds no definitions, translations, flashcards, generic review framework, cloud persistence, or phrase editing.

## M11 — IELTS Skill Foundations

M0–M10 are accepted. M11 is implemented and awaiting merge; M12 has not started. M11 provides non-official IELTS-style Reading and Writing Task 2 foundations. Reading is explicitly generated from a sanitized bounded source only when it has at least 400 words, always contains exactly six questions (three multiple-choice and three True / False / Not Given), validates all relevant source excerpts, caches locally by source/provider/model/schema identity, and grades locally. Task 2 uses twelve application-owned prompts, browser-local drafts and optional timers, four qualitative criterion sections, controlled grammar/vocabulary/coherence feedback, and explicit initial/revision analysis. High-confidence language issues reuse Personal Error Memory; technical-accuracy findings, bands, CEFR, readiness, Task 1, Listening, Speaking, full mocks, and official-exam claims remain out of scope. Two UI-triggered Reading attempts were blocked by repeated Gemini transient unavailability after the existing bounded retry path; no malformed/partial practice was saved, Writing live calls were not attempted under the stop rule, and automated/non-live verification is green. Successful live provider-contract execution therefore remains unverified.
