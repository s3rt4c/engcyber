# Architectural decisions

## Next.js with TypeScript and Tailwind

Next.js keeps the UI and server-only integration routes in one TypeScript application. Tailwind supports a small, maintainable shell without introducing a separate frontend layer.

## Supabase with PostgreSQL

Supabase provides a straightforward hosted PostgreSQL path when persistence begins. Domain types and repository seams remain independent from Supabase queries so the application does not become client-SDK driven.

## Browser TTS first

Web Speech satisfies initial sentence playback, rate, replay, and shadowing needs without paid TTS infrastructure. The `BrowserTts` boundary keeps later replacement possible.

## ChatGPT Voice remains external initially

The learner can use ChatGPT Plus Voice now. The application will later accept a concise session report and fold useful errors into one personal error system, avoiding premature Realtime API cost and complexity.

## Discovery is separate from lesson generation

Source discovery gathers inexpensive metadata only. Lesson generation is an explicit learner request, controlling AI cost and ensuring study effort follows interest.

## Lesson and sentence work are cacheable by identity

Normalised, sanitised content will receive a fingerprint. Lesson generation will use a fingerprint derived from the content, learner level, and prompt version, so an existing compatible lesson can be reused instead of making another model call. Reusable sentence-action results can be persisted alongside their lesson sentence when M2 introduces them.

## Source adapters isolate source mechanics

RSS, Atom, manual URL, manual text, and later extraction mechanisms are all adapters. Pages and lesson logic depend on the common boundary rather than on a particular publisher.

## M1 source choices

M1 discovers metadata through official RSS feeds only: CISA Cybersecurity Advisories (`https://www.cisa.gov/cybersecurity-advisories/all.xml`) for Cybersecurity News and Hugging Face Blog (`https://huggingface.co/blog/feed.xml`) for Artificial Intelligence. The feeds are fetched server-side with a 15-minute revalidation hint and a 10-second timeout; discovery does not invoke AI.

## Authentic content is not permanently simplified to B1

The original text remains central. Simpler English and optional Turkish are temporary scaffolds; support should reduce as comprehension improves.

## External content is untrusted

Imported content is data, never authority. It must be sanitised before display, never executed, and isolated from system and developer instructions before any model request.

## M1 local phrase persistence

M1 uses a dedicated browser-local `PhraseStore` adapter. It stores a phrase, its context, attribution, content identity, and timestamp while deduplicating obvious repeats. This is temporary: migrate the same contract to Supabase when cross-device persistence, authentication, or multi-user support matters.

## M2 learner, lesson, and cache decisions

M2 has one versioned, framework-independent personal learner profile: B1, IELTS Band 7.0, strong B2 / early C1 functional target, Turkish support, and technical interests. Lessons are generated only after an explicit Create Lesson action. AI selection is server-only and provider-independent: Gemini is the current personal runtime, while Gemini and OpenAI are both supported through one resolver. Each provider requires its own explicitly configured action and lesson model; there is no silent model fallback.

The server computes a generation fingerprint from the sanitised content fingerprint, learner-profile version, lesson prompt version, lesson schema version, provider, and configured lesson model. Provider-native structured output is parsed, then validated against the canonical Zod schema and grounding rules before caching or rendering. Lesson generation does not enable tools, web grounding, URL context, code execution, or function calling. A versioned browser-local `LessonStore` retains up to 20 compatible lessons temporarily; migrate that same boundary to Supabase when cross-device persistence, authentication, or multi-user support matters.

## M3 writing feedback and Error Memory

Writing is never analyzed automatically: typing, discovery, reading, and opening a lesson make no writing-analysis request. The learner explicitly chooses `Analyze Writing`, then independently revises before choosing `Review My Revision`. Initial feedback cannot contain an improved full answer; only revision feedback may contain a compact, source-grounded comparison example.

The provider can return only controlled category and subcategory enums. The application derives each canonical pattern key as `category.subcategory`, suppresses confidence below 0.65, shows 0.65–0.84 feedback without aggregating it, and stores non-dismissed feedback at or above 0.85 in Error Memory. Technical-accuracy feedback requires source evidence from the bounded sanitized source. Article data, learner text, prior feedback, and compact memory are independently delimited untrusted inputs; writing analysis has no tools, search, URL context, or code execution.

M3 stores single-user `WritingSessionStore` and `ErrorMemoryStore` data in separate versioned browser-local adapters. Sessions retain drafts, validated feedback, and content/lesson identities but never duplicate full article text. The pragmatic MVP limits are 50 sessions, 200 occurrences, and 100 derived patterns. Corrupt/unavailable browser storage fails safely. Migrate these contracts to Supabase when cross-device persistence, authentication, or multi-user support becomes relevant.

Error patterns are application-derived, not model-decided: first eligible occurrence is `needs_practice`; a correction becomes `improving`; three successful corrections in separate writing sessions become `mastered`; a later unresolved recurrence becomes `returned`. A `Not an error` action uses no AI, marks the occurrence dismissed, and deterministically rebuilds aggregates, removing empty patterns.

## M4 error-pattern review only

M4 keeps `ReviewStore` separate from `ErrorMemoryStore`. A pure, idempotent synchronizer creates one `sourceType: "error_pattern"` ReviewItem for each eligible Personal Error Memory pattern, retains valid representative occurrences, removes items whose evidence disappears, and reactivates returned patterns at stage 0 due in one day. This is intentionally lightweight future compatibility—not a generic multi-source review framework.

Only successful scheduled reviews performed when due advance the deterministic schedule: new pattern due +1 day, then +3, +7, and +14 days; the final due stage-3 success masters the ReviewItem and ErrorPattern. Successful early `Practice Now` sessions are recorded as supplemental practice but never move stage or due date. Any incorrect answer decrements the stage by at most one, schedules +1 day, increments lapse evidence, and keeps the related pattern `needs_practice`. An uncertain provider verdict records an event but does not change the schedule.

Stage 0–1 historical corrections use a safely normalized exact local comparison first, without an AI call. Non-identical plausible corrections and stage 2–3 free-production answers call the provider-neutral `review_evaluation` capability explicitly. The provider judges only the target pattern and cannot control scheduling. Review events retain metadata only—never learner answers—and the local MVP retains at most 100 ReviewItems and 500 events. Phrase/vocabulary SRS and flashcards remain out of scope until a future milestone.

## M5 browser-local listening and shadowing

M5 creates listening exercises deterministically from saved lesson difficult sentences first, then phrase examples, and finally only an already-available bounded sanitized source sentence. It never refetches, regenerates, or calls an AI provider to fill a session; five exercises is a maximum, not a minimum. The browser-local `ListeningStore` is separate from LessonStore and ReviewStore, keeps at most 20 sessions and 200 combined compact dictation/shadowing events, and retains selected exercise sentences but never full articles or learner-entered dictation.

Dictation is application-scored with conservative Unicode/whitespace/quote/case/terminal-punctuation normalization and deterministic edit-distance alignment. Accuracy is `round(max(0, 1 - editDistance / targetWordCount) * 100)`, clamped to 0–100; 100 is Correct, 80–99 is Nearly there, and below 80 is Try again. Browser SpeechSynthesis is the only M5 audio layer: fixed rates are 0.75x, 0.9x, 1.0x, and 1.15x; the persisted default is 1.0x. Shadowing records repetition as practice evidence only and never claims pronunciation evaluation. Migrate this contract to Supabase only when cross-device persistence, authentication, or multi-user support becomes relevant.

## M6 curated source registry

M6 uses exactly four application-controlled HTTPS feed entries: CISA Cybersecurity Advisories, Hugging Face Blog, SANS ISC Handler's Diary title-oriented RSS, and Google Cloud Threat Intelligence. The registry owns stable source identity, display attribution, category, content kind, publisher metadata, priority, and endpoint; publisher feed titles and categories cannot redefine those fields. Adding a future source normally requires one registry entry plus successful compatibility and safety verification, not a publisher-specific parser.

Feed discovery accepts only bounded RSS/Atom XML metadata through server-side public-address, redirect, timeout, content-type, and response-size controls. XML declarations containing `DOCTYPE` or `ENTITY` are rejected before parsing; feed HTML is reduced to bounded plain text. Only actionable HTTP(S) feed links—or explicit safe GUID permalinks—become cards. Discover keeps source health local to each publisher, deduplicates conservative canonical URLs, and filters/sorts in the browser without provider calls. It never treats feed content as article `Content`: explicit article opening still uses safe fetch, extraction, and sanitisation. Persistent source preferences and arbitrary subscriptions are deferred. The SANS feed is reliable for discovery, but its publisher may answer the server-side article request with HTTP 406; the existing safe failure and original-link fallback must remain rather than weakening fetch protections.

## M7 podcast and transcript boundary

M7 has exactly one application-controlled podcast source: Darknet Diaries. Its RSS supplies bounded `PodcastEpisode` metadata only; non-standard items without an official `https://darknetdiaries.com/episode/<number>/` URL are skipped. Feed GUID is opaque stable identity text, with canonical official episode URL only as fallback. RSS descriptions never become transcript content. Audio enclosures are HTTPS, credential-free browser playback URLs only: no proxy, autoplay, byte storage, or settings store.

Transcript loading is a learner action. The server resolves `episodeId` against current bounded RSS metadata, safely fetches the official episode page, extracts its explicit approved HTTPS `/transcript/<number>/` relationship, then safely fetches the transcript. Only `article.single-post` can be extracted; selector failure is a safe failure. The transcript response cap is 512 KiB and cleaned text cap is 250,000 characters; no silent truncation occurs. Cleaned speaker-aware turns and deterministic study passages exist only in page/session state. Passage segmentation targets roughly 220 words (with a practical lower target near 150 and a 300-word hard maximum); a selected bounded passage can become ephemeral sanitized `Content` for the existing explicit lesson capability. No complete transcript reaches a provider or localStorage.

## M8 derived local analytics

M8 derives a fresh `ProgressSnapshot` from existing browser-local LessonStore, WritingSessionStore, ErrorMemoryStore, ReviewStore, and ListeningStore interfaces. It adds no ProgressStore, analytics event log, database table, cloud persistence, provider capability, telemetry SDK, or network dependency. PhraseStore is intentionally excluded because its M1 boundary supports safe saves only; transient podcast/transcript data is also excluded, while any saved lesson created from a passage counts as an ordinary lesson.

Range-scoped completed events use supplied learner-local IANA timezone calendar days: today plus six prior days, today plus 29 prior days, or all valid non-future evidence. Current Error Memory lifecycle counts and current ReviewItem due/overdue/mastered state remain current state regardless of the selected event range. A legacy revision without `revisionReviewedAt` is not assigned an invented date and is excluded from dated revision metrics. New successful `Review My Revision` actions persist optional `revisionReviewedAt`; dismissal preserves it.

Recommendations are fixed templates based on explicit evidence and a maximum of three: overdue/due review work, returned patterns, high-priority recurring patterns (at least two occurrences and priority at least 40), neglected selected-range activity, revision follow-through, limited listening consistency, then generic zero-activity guidance. Listening comparison requires at least three dictations in both finite periods and a five-point average difference before directional wording. M8 never estimates IELTS/CEFR level, fluency, vocabulary size, an overall score, or mastery from activity counts.

## M9 daily hub, local library, and bounded resume context

M9 adds no learning engine and no dashboard store. Read-only loaders compose existing LessonStore, PhraseStore, WritingSessionStore, ErrorMemoryStore, ReviewStore, and ListeningStore into a small Daily Learning Hub and Library. Home never synchronizes or writes ReviewStore; its due/overdue numbers are the current persisted state only. Progress keeps its pure deterministic aggregation, and exposes only a narrow semantic focus action (`review`, `listening`, `discover`, or `library`); UI code owns routes.

New StoredLesson records may contain a validated `m9-lesson-context-v1`: title, optional source label, safe HTTP(S) source URL, identities/category/type, and the exact existing `buildLessonSource()` output, capped at 12,000 characters. This is the bounded sanitized generation source, not an article or transcript archive. Older context-free lessons remain listed and reload-safe; no source is invented or silently refetched, and source-dependent new writing analysis is disabled while existing feedback remains visible.

Phrase duplicate detection remains the M1 normalized phrase + exact source URL + trimmed context signature. It is not the phrase record identity. M9 assigns every new or successfully migrated legacy phrase an application-owned durable unique ID, so anomalous historic duplicates remain separately visible and individually deletable. Browser storage is still temporary: the Library says “Saved in this browser.” Move these contracts to Supabase only when authentication, multi-user, or cross-device persistence is actually required. M9 adds no phrase SRS, ReviewItems, flashcards, mastery, or schedule; that is M10 work.

## M10 phrase and vocabulary SRS

M10 adds a dedicated browser-local `VocabularyReviewStore`, deliberately separate from M4 `ReviewStore`, `ReviewItem`, `ReviewEvent`, and Error Pattern scheduling. A `VocabularyReviewItem` references only the durable `SavedPhrase.id`; phrase wording, context, source, and URL remain in PhraseStore. Saving a phrase never enrolls it. Explicit enrollment creates stage 0, `learning`, due in one day, with a 200-item hard limit and no eviction. Removing review clears its item and metadata events while preserving the phrase; deleting a phrase first requires successful vocabulary cleanup, then deletes the phrase without claiming a rollback if the second step fails.

The application owns the deterministic schedule: due success advances +3, +7, +14, +30, then +60 days to stage 5/mastered; mastered due success stays at stage 5/+60. A miss schedules +1 day and decrements by one stage, except mastered misses become returned stage 2. Returned items remain returned through stages 2–4 and only regain mastered status at stage 5. Non-due correct Practice Now records metadata only; non-due incorrect follows normal failure scheduling. Events store identifiers, timestamps, outcome, state transitions, and scheduling effect only—never answers, phrase text, context, or provider output. The local store retains 200 items and the newest 1,000 events.

Vocabulary practice is zero-AI and zero-network: exact authentic-context cloze masks only literal phrase occurrences, then falls back to source-attribution recall. Answer checking permits Unicode normalization, whitespace/case normalization, and terminal punctuation only. Corrupt vocabulary storage reads as a non-destructive empty fallback; read-only Home, Library, Progress, and queue calculations neither clean it up nor mutate PhraseStore. Migrate the dedicated contracts to Supabase only when cross-device persistence, authentication, or multi-user support becomes relevant.
