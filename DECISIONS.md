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

## M11 IELTS-style Reading and Writing Task 2 foundations

M0–M11 are accepted. It is explicitly non-official IELTS-style practice: no band, CEFR, readiness, proficiency, numeric criterion score, official mock, or examiner claim is stored or rendered. M11 covers Reading and Writing Task 2; the later M12 Listening foundation is a separate local-only contract. Speaking, Task 1, full mocks, and assessment remain deferred.

Reading is generated only after an explicit learner request from sanitized current Content or a validated M9 StoredLessonContext. The application reuses the existing canonical 12,000-character `buildLessonSource()` bound and blocks sources below 400 words before resolving a provider. The provider-neutral `ielts_reading_generation` capability uses the configured lesson model, no tools/search/URL context/code execution, and a strict schema: six questions, exactly three multiple-choice and three True / False / Not Given. Each returned bounded relevant source context must be an exact supplied-source substring. A fingerprint includes source, provider/model, schema/prompt, and learner-profile versions; a compatible browser-local record is reopened without generation. Reading answers, completion evidence, and optional elapsed time are local; grading is deterministic and local.

Writing Task 2 uses twelve application-owned prompts, a 250-word guidance threshold (not a submission gate), browser-local drafts, a simple optional timer, and explicit initial/revision provider calls. Initial feedback has exactly four qualitative criteria and no `improvedExample`; revision feedback compares stable initial issue IDs and may include one bounded improvement example. Provider language issues can use only the existing grammar/vocabulary/coherence taxonomy—never `technical_accuracy`—and application code derives pattern keys. Existing Error Memory thresholds, aggregation, dismissal, and lifecycle remain authoritative. The local `IeltsPracticeStore` retains 30 Reading and 30 Writing records; it stores validated material only, never raw provider output or a second article/transcript copy. IELTS completion/analysis/revision events add a separate Progress section and Active Days evidence without changing M8 Learning Balance dimensions.

Acceptance note: two separate explicit UI Reading attempts reached Gemini, exhausted the existing bounded transient retry path, and returned temporary-unavailability errors. Neither saved malformed or partial practice. Writing live calls were not attempted under the accepted stop rule. Successful live provider-contract execution is therefore unverified because of external transient availability; this did not justify changing retry counts, schemas, providers, or validation. Automated and non-live verification cover the provider contracts, schema, domain, and persistence behavior.

## M12 IELTS-oriented Listening foundations

M12 is accepted and merged. It adds a separate immutable application-owned `IeltsListeningPracticeDefinition` bank, with exactly eight original practices distributed evenly across four IELTS-oriented style labels. Each uses structured script turns and exactly three four-option multiple-choice plus three completion questions. Every authored relevant transcript segment must be an exact segment of the matching script; completion matching normalizes only Unicode NFKC, whitespace, case, and terminal `.`, `!`, or `?` before comparing against explicit accepted answers. There is no semantic or provider fallback.

The existing browser-only `BrowserSpeechSynthesis` seam queues script turns safely at 1.0x. A session records the first actual playback start and successful starts only; unavailable or failed browser synthesis neither exposes the transcript nor completes the practice. Learning-mode replay is allowed and has no scoring, Progress, Active Day, or balance consequence. Before explicit completion, normal learner UI does not reveal any transcript, correct or accepted answer, explanation, or relevant excerpt. Submission requires every answer, grades locally, sets a fixed count out of six and completion timestamp, and freezes the attempt. An unfinished session is resumed by definition; a completed definition creates a distinct new session when repeated. Browser automation verified SpeechSynthesis invocation and `onstart`, but not physical audible output; that non-blocking limitation is retained as M12 PASS WITH NOTE.

## M13 Versioned Export / Import & Local Backup

M13 is a browser-local recovery boundary, not synchronization: a versioned `engcyber-backup` manifest contains only the eight established learner-data stores and metadata required to validate its format. A named manifest schema, migration seam, total 16 MiB UTF-8 limit, current store caps, referential checks, and explicit legacy phrase-ID normalization make malformed, incomplete, unsupported, oversized, or internally inconsistent files reject before a preview or write. The pre-write preview contains counts only, never user content.

Export is a local explicit download and must not mutate storage. Restore is replace-only after the learner explicitly confirms it; it snapshots only the same allowlisted keys, writes canonical existing envelopes in deterministic order, read-back checks every key, and attempts reverse-order rollback on write/quota failure. It never calls a provider/server, clears arbitrary storage, imports browser secrets/settings/cache/DevTools/application state, performs automatic backup or sync, exports individual records, adds encryption/key management, or creates database/server migrations.

`IeltsPracticeStore` evolves from the M11 envelope to a versioned M12 envelope with independent Reading, Writing, and Listening collections. Valid M11 reads migrate in memory without rewriting browser storage; only an explicit successful save writes M12. Listening retains at most 30 newest-by-`updatedAt`-then-ID sessions and never evicts the other collections or M5 records. Completed M12 Listening attempts contribute a separate fraction-based IELTS evidence view, a dated Activity Day event, and exactly one direct M8 Learning Balance Listening activity each. No fake M5 session, dictation, or shadowing record is created. M12 has no provider capability, API route, audio fetch, microphone API, MediaRecorder, STT, speech recognition, pronunciation/fluency scoring, Speaking UI, or Speaking analytics; Speaking remains external to EngCyber through ChatGPT Live / Voice.

## M14 IELTS continuity and one completion-event derivation

M14 is a read-only presentation seam over the accepted `IeltsPracticeStore`, not a `ContinuationStore`, history store, Home store, or analytics snapshot. `src/domain/ielts-continuity.ts` is framework-, browser-, and provider-independent. It emits deterministic durable IDs and canonical deep links for unfinished Reading, nonblank Task 2 drafts, Task 2 revision work after accepted initial feedback, and unfinished Listening. It separately emits exactly one completion event for Reading submit, Task 2 initial feedback, Task 2 revision review, and Listening submit; drafts, prompt selection, route opening, answer edits, and playback are not activity events. Invalid optional timestamps omit only their derived row/event without modifying stored records.

Home bounds IELTS continuations at three and omits the section when empty. The IELTS hub bounds cross-skill continuations at three and recent activity at five. Progress maps its explicit IELTS timeline category only from this single completed-event derivation, which prevents parallel Listening timeline construction. Existing Active Day aggregation and Learning Balance remain accepted: Listening continues to add one Listening balance activity, while IELTS Reading/Writing do not add balance dimensions. Focus uses the same selected completed-event data only to avoid a false generic zero-activity state; it does not rank skills or alter neglect recommendations. M14 creates no localStorage key, backup-domain entry, manifest/version bump, provider path, or network call.

## M15 critical-path browser acceptance

M15 adds a test-only Playwright layer, not a product capability. Chromium runs four synthetic, isolated browser contexts against a production build and `next start`: Backup download/upload/replace/reload with unrelated-storage preservation; Home-to-IELTS continuation/deep-link/reload; completed IELTS activity through Progress with one Listening representation; and DOM Range selection through phrase save and Vocabulary enrollment. Initial fixture injection writes only current valid localStorage envelopes before first navigation. The shared browser guard aborts and fails any external HTTP(S) origin; selected paths make no provider request and CI supplies no provider secret. Vitest remains authoritative for domain, schema, migration, scheduling, and provider contracts. M15 does not prove audible browser sound, add persistence, test routes, provider branches, broad browser coverage, visual snapshots, or M16.

## M16 application security envelope

M16 treats POST API calls as untrusted browser input even though learner persistence remains local. A narrow server-only request boundary reads bytes incrementally before JSON parsing, applies the approved route-specific cap, enforces `application/json`, and requires an exact expected Origin. Production requires `ENGCYBER_APP_ORIGIN`; development/test accepts only explicit localhost or loopback origins derived from the local request URL. `Sec-Fetch-Site: cross-site` is rejected when present. This is browser cross-site protection, not authentication or bot protection.

All API responses explicitly use `Cache-Control: no-store`, unknown failures become stable public errors, and routes never blindly return an exception message. Next configuration disables `X-Powered-By` and adds non-CSP baseline headers. CSP is deliberately deferred pending production-runtime verification; HSTS belongs at a selected HTTPS deployment edge. Existing safe-fetch DNS/IP/redirect/size controls remain unchanged, including the honest DNS-rebinding residual risk. The provider boundary keeps at most three EngCyber retry attempts; OpenAI SDK retries are disabled and each OpenAI request has a supported 20-second timeout. Gemini caller waits are also 20 seconds but do not claim upstream cancellation.

This is not public-deployment approval. M16 adds no custom login, account store, Redis/KV, distributed rate limiter, database, server learner data, or backup change. The next realistic deployment remains private single-user access behind a hosting/platform/reverse-proxy boundary, with authoritative distributed abuse controls selected for that host.

M17 selects Vercel as the unchanged Next.js origin, Cloudflare Access as the single-user external gate, origin-side cryptographic verification of Cloudflare Access JWTs, and Upstash Redis for distributed control-plane state. `proxy.ts` verifies signature, issuer, audience, expiry/not-before, and non-empty `sub` using cached remote JWKS rather than a static certificate. It strips client-supplied internal identity and propagates only the verified opaque subject. Private production fails closed for missing Access configuration/JWT/JWKS verification; local/E2E operation requires explicit local-test configuration.

The shared Upstash policy uses atomic Redis-side token buckets and at most two concurrently admitted EngCyber AI operations per verified subject with expiring 90-second leases. All six AI capabilities share burst 3 and 6 initiations/minute; manual URL import is burst 2 and 3/minute; application-controlled fetch is burst 10 and 30/minute. Redis failure blocks provider and expensive external fetch work with safe 503. One user action consumes one token/lease even when its provider boundary retries internally. Gemini work may outlive client-side timeout/cancellation, so the lease does not assert provider-side cancellation or hard Gemini-backend concurrency. Redis never holds learner, writing, phrase, IELTS, or backup data. External configuration is pending; this is not a declaration that private deployment is active.
