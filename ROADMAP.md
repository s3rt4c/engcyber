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

Accepted: explicitly enrolled saved phrases only; dedicated `VocabularyReviewStore`; deterministic 1/3/7/14/30/60-day retrieval progression; context-cloze/source-recall exercises; conservative local exact matching; returned-error recovery; and metadata-only events. It deliberately remains separate from M4 Error Pattern Review, uses no AI or network calls, and adds no definitions, translations, flashcards, generic review framework, cloud persistence, or phrase editing.

## M11 — IELTS Skill Foundations

M0–M11 are accepted. M11 provides non-official IELTS-style Reading and Writing Task 2 foundations. Reading is explicitly generated from a sanitized bounded source only when it has at least 400 words, always contains exactly six questions (three multiple-choice and three True / False / Not Given), validates all relevant source excerpts, caches locally by source/provider/model/schema identity, and grades locally. Task 2 uses twelve application-owned prompts, browser-local drafts and optional timers, four qualitative criterion sections, controlled grammar/vocabulary/coherence feedback, and explicit initial/revision analysis. High-confidence language issues reuse Personal Error Memory; technical-accuracy findings, bands, CEFR, readiness, Task 1, full mocks, and official-exam claims remain out of scope. Two UI-triggered Reading attempts were blocked by repeated Gemini transient unavailability after the existing bounded retry path; no malformed/partial practice was saved, Writing live calls were not attempted under the stop rule, and automated/non-live verification is green. Successful live provider-contract execution therefore remains unverified.

## M12 — IELTS Listening Foundations

Accepted and merged. M12 adds exactly eight original application-owned IELTS-oriented Listening mini-practices: two `part1_conversation`, two `part2_monologue`, two `part3_discussion`, and two `part4_lecture`. Each immutable definition has structured script turns and exactly six locally graded questions (three four-option multiple choice and three explicit-answer completion). Browser SpeechSynthesis provides 1.0x synthesized playback and learning-mode replay. The transcript, correct answers, accepted answers, explanations, and relevant script excerpts remain hidden until the learner explicitly submits all six answers. A completed, immutable browser-local session records only reference IDs, answers, successful playback metadata, local score, and timestamps; it can be repeated as a new attempt and retains at most 30 Listening sessions independently from Reading, Writing, and M5 Listening. It uses no provider, network audio, microphone, recording, STT, speech recognition, scoring, Speaking route, or Speaking analytics. Speaking remains external to EngCyber through ChatGPT Live / Voice. Completed sessions add fraction-based IELTS Listening evidence, one Active Day event, and one existing M8 Learning Balance Listening activity without creating fake M5 records. SpeechSynthesis invocation and `onstart` were verified, but browser automation did not independently verify physical audible output; this is the non-blocking M12 PASS WITH NOTE.

## M13 — Versioned Export / Import & Local Backup

Accepted and merged. `/backup` exports and imports a strict, versioned `engcyber-backup` manifest for exactly the eight existing learner-data stores. Export has no side effects and requires an explicit browser download. Import has a size bound, validates format/version/schema/domain invariants before it can show a count-only preview, and writes no key until explicit replacement confirmation. Restore snapshots the exact allowlisted keys, serializes the canonical store envelopes in a deterministic order, verifies each write by readback, and rolls back touched keys in reverse order if a quota or write failure occurs. It never reads, exports, clears, restores, or modifies unrelated browser storage; it introduces no server route, provider call, network synchronization, cloud backup, automatic backup, sharing, encryption/key management, database migration, or M14 work.

## M14 — IELTS & Home Continuity

Accepted and merged. M14 adds no practice engine, store, route, assessment, or durable data: one pure selector derives unfinished Reading, meaningful Task 2 draft/revision, and unfinished Listening continuation links from the accepted `IeltsPracticeStore` records. Home presents up to three direct canonical IELTS continuations only when there is resumable work. `/ielts` presents up to three continuations plus five recent completed activity entries across Reading, Writing Task 2, and Listening. The same completed-event derivation supplies one explicit Progress IELTS timeline category so completed Listening is not duplicated. Active Days and Learning Balance stay unchanged; the only Focus adjustment suppresses generic `zero_activity` for meaningful completed IELTS evidence. Passive Home, IELTS, and Progress reads make no provider/network/telemetry call, and no backup format or manifest changes.

## M15 — Critical-Path Browser E2E Acceptance

Accepted and merged. Four isolated synthetic Chromium Playwright tests run against production `next start`: Backup export/restore, IELTS continuation/reload, completed IELTS activity/Progress, and Reading phrase selection through Vocabulary enrollment. They are provider-free, require no secrets, reject external browser HTTP(S) product traffic, retain traces/screenshots only on failure, and run in a separate required CI `e2e` job. They complement rather than replace Vitest; physical audible output, broad browser coverage, and visual regression remain out of scope.

## M16 — Application Security Envelope

Accepted and merged. Every POST API route uses a route-specific byte-bounded JSON reader, accepts only JSON, requires an exact configured production origin (or an explicit localhost development origin), and rejects `Sec-Fetch-Site: cross-site`. All API responses are `Cache-Control: no-store` and return stable public failures rather than raw provider/upstream details. Baseline non-CSP headers disable `X-Powered-By`, prevent content sniffing and framing, suppress referrers, and deny unused browser permissions. External article links are actionable only after HTTP(S)-only normalization. Provider attempts are bounded to 20 seconds; Gemini caller waits may still leave upstream work running, while OpenAI SDK attempts use its supported timeout with SDK retries disabled so EngCyber's existing three-attempt retry policy remains authoritative.

Repository implementation in progress; external deployment configuration pending. M17 selects Cloudflare Access, a Cloudflare-proxied custom hostname, a Vercel Next.js origin with Access JWT verification, and Upstash Redis distributed controls. All six AI capabilities share one verified-subject burst-three, six-per-minute budget and at most two concurrently admitted EngCyber AI operations with expiring 90-second leases. Gemini work may outlive client-side timeout/cancellation. Manual URL import and application-controlled fetches have independent budgets; Redis failure blocks expensive work. This adds no custom account system, learner persistence, backup change, CSP enforcement, HSTS, public SaaS, deployment job, or M18 work.
