# M0 architecture

## Boundaries

`src/domain` owns stable concepts and interfaces. `src/app` renders the shell. `src/server` owns code that may access server credentials. `src/server/env.ts` is marked `server-only`, so importing it from a Client Component fails the Next.js build.

```
SourceAdapter -> FeedItem metadata -> learner request -> ContentExtractor
                                         |                    |
                                     no AI work       ExtractedContent (raw)
                                                              |
                                                       ContentSanitizer
                                                              |
                                                   Content (sanitised) -> LessonGenerator
```

An adapter can discover metadata through RSS, Atom, a manual URL, manual text, or a future crawler. Extraction is separate. The first crawler is intentionally out of M0.

## Trust boundary

Publisher material—including scripts, exploit snippets, shell commands, HTML, and prompt-like text—is untrusted. M1 must validate manual URLs and apply SSRF protections before fetching. It must parse raw output into `ExtractedContent`, then sanitise it before persistence or rendering, producing `Content`. Only `Content` may reach lesson generation. Model requests must use fixed application instructions and pass sanitised content in a clearly delimited data field; imported text cannot select tools, alter policy, or execute commands.

## Learning progression

The learner sees authentic English first. A later sentence action can provide simpler English and then optional Turkish support, while retaining the original sentence. Categories and content mix are values in the domain layer so technical/IELTS balance can become configuration instead of an architectural constant.

## Cost controls

Discovery stores metadata only. A sanitised content fingerprint invalidates cached work if source text changes. A lesson generation fingerprint will incorporate that content fingerprint, learner level, and prompt version; it supports reusing a compatible generated lesson. Individual sentence actions may be cached only when their input sentence and action parameters are identical. Browser TTS remains local and has no per-request provider cost.

## M1 implementation notes

M1 uses CISA Cybersecurity Advisories and the Hugging Face Blog RSS feeds, fetched server-side with a 15-minute revalidation hint. Manual URL import validates the scheme, credentials, literal/resolved private addresses, redirects, response type, timeout, and size. DNS rebinding between lookup and connection remains an SSRF limitation of runtime `fetch`; deployment egress controls should remain the final network boundary. Raw HTML becomes plain readable text through server extraction and sanitization. AI sentence actions are explicit selection-only requests through the active provider with fixed instructions and delimited article data; missing provider configuration does not affect discovery, reading, or TTS.

## M2 lesson engine

Only a learner click on Create Lesson calls the lesson identity endpoint. The server owns the default learner profile, prompt/schema versions, and one provider resolver. Gemini and OpenAI are supported; Gemini is the current personal runtime. The browser checks its `LessonStore` first, and a cache hit opens a validated lesson without any provider call. On a miss, the generation endpoint independently revalidates sanitized content and recomputes identity before calling the selected provider with no tools.

Lesson input is bounded to 12,000 characters as a cost-control implementation limit. It preserves complete opening, middle, and later paragraphs where possible, records whether truncation occurred, and never makes a second AI call to shorten an article. The generation fingerprint includes provider and model identity. Gemini uses its native Developer API with JSON Schema structured output; all providers must still pass canonical Zod and grounding validation. Untrusted article data remains delimited outside privileged instructions; the providers do not enable search, URL context, code execution, function calling, or other tools. M3, not M2, adds writing feedback and personal error memory.

## M3 writing feedback and Personal Error Memory

The writing editor is a Client Component because it owns local draft state and browser-local persistence. It sends a draft only on the explicit first or second evaluation button; ordinary typing, reading, and session restore make no AI request. The server route revalidates sanitized content, bounded writing data, structured feedback, and source grounding before it returns canonical data to the browser.

```
learner draft (local) -- explicit Analyze Writing --> server writing route
                                                       |
                                            active provider lesson model
                                                       |
                                      canonical Zod + source/draft validation
                                                       |
WritingSessionStore <--- validated feedback --- WritingPractice --- ErrorMemoryStore
                                                               (high-confidence only)
```

`writing_analysis` reuses the provider-neutral lesson-capability model and the existing bounded transient retry executor. Gemini native JSON and OpenAI structured output both converge on the same domain schema. Each provider receives separately delimited untrusted article, task, learner writing, compact error-memory summary, and (for a revision) initial feedback. It has no tools, search, URL context, code execution, or function calls. Technical corrections require source evidence that is present in the bounded sanitized source.

Error Memory is browser-local MVP persistence, not an M4 review system. It retains up to 50 sessions, 200 high-confidence occurrences, and 100 derived patterns. Dismissal marks a local occurrence and rebuilds aggregates without a provider request; zero-occurrence patterns disappear. Sessions store identities and learner text/validated feedback, never repeated article bodies.

## M4 error-pattern review and spaced repetition

M4 adds a separate browser-local `ReviewStore`, not phrase persistence and not a generic review-plugin framework. A pure domain synchronizer consumes Error Patterns, eligible Error Occurrences, existing ReviewItems, and `now`; it creates missing stage-0 items due in one day, retains one valid representative occurrence per pattern, removes items without eligible evidence, and resets a returned mastered pattern to stage 0 with one added lapse. `sourceType: "error_pattern"` is a narrow compatibility field for a possible future PhraseReviewSource, but M4 does not schedule phrases.

`ReviewStore` owns at most 100 scheduling items and 500 metadata-only ReviewEvents. Error Memory retains the historic evidence and a small review-earned lifecycle status; it holds no schedules or review events. Successful due reviews progress +3, +7, and +14 days through stages 0–3, then master both the ReviewItem and ErrorPattern. Early successful Practice Now sessions are logged but cannot advance mastery. Incorrect answers deterministically reduce stage by one (at most), reschedule +1 day, and return the pattern to `needs_practice`; uncertain provider results are schedule-neutral.

Stage 0–1 correction exercises never expose the canonical answer before submission and are locally accepted only on safe normalized equality. A non-identical correction or stage 2–3 free-production answer goes through the server-only `review_evaluation` capability, which reuses the configured action model and bounded transient retry policy. The provider receives narrow, delimited historical data and judges only the target pattern; it has no tools and returns no scheduling decision. Browser storage failures or corrupt data leave an empty/unsaved local snapshot rather than throwing into reading or writing flows.

## M5 listening and shadowing

M5 is a client-only learning loop. `ListeningPractice` gets saved lessons from `LessonStore`, then pure domain selection creates no more than five stable `ListeningExercise` values: difficult sentence, phrase example, then an already-present sanitized source sentence only when available. It never refetches content, regenerates a lesson, calls an API route, or imports server/provider code. The route uses a separate versioned `ListeningStore`; it retains selected sentence text needed to resume a small session but never a full article or typed dictation.

`BrowserSpeechSynthesis` owns `speechSynthesis.cancel`, utterance lifecycle, fixed playback rates, English-voice preference, and asynchronous `voiceschanged` refresh. Missing browser speech leaves the transcript and local exercise flow usable. Dictation transcript text is conditionally rendered only after explicit local checking—not hidden in CSS, ARIA labels, titles, or placeholders. Local edit-distance alignment produces matched, missing, extra, and substitution evidence; no semantic/fuzzy/provider grading is used. Shadowing shows text-preserving deterministic chunks and records only an explicit local repetition, with no pronunciation, fluency, or speech-correctness claim.

## M6 curated-source discovery

`src/server/discovery/source-registry.ts` is a server-only, typed, application-controlled list of four approved HTTPS RSS sources. `feeds.ts` fetches all entries concurrently through the same public-address and redirect protections used for external network text, but with a feed-only XML content-type allowlist, a ten-second timeout, three redirects, and a two-megabyte streamed cap. It rejects `DOCTYPE` and `ENTITY` declarations before `fast-xml-parser` receives the body, emits only narrow canonical metadata, and never renders or stores raw XML.

The normalizer accepts RSS and Atom fixtures. It retains only a bounded title, summary, author, valid UTC date, canonical action URL, source ID/name, application-controlled category, and content kind. A source-defined priority resolves exact canonical-URL duplicates; similar titles with different URLs remain distinct. Invalid or missing dates are `null`; dated values sort first and all ties use stable IDs. Each source produces `available` or `temporarily_unavailable` state without exposing raw infrastructure errors to learners.

The client imports only domain discovery types and pure local filtering/sorting. It cannot import the server registry, parser, fetcher, or AI providers. A card click forwards feed metadata to the existing explicit URL flow; only that click may fetch an article body, then extraction and sanitisation produce `Content`. Feed descriptions, including full-text syndication, are never accepted as authoritative article content. No discovery, refresh, filter, sort, health view, or article opening calls Gemini or OpenAI.

## M7 podcast transcripts

M7 keeps `PodcastEpisode` metadata distinct from `TranscriptDocument` content. `GET /api/podcasts` reads exactly one application-controlled Darknet Diaries RSS feed and returns only bounded valid numbered episode metadata; it does not fetch episode pages, transcripts, audio, or providers. `GET /api/podcasts/[episodeId]/transcript` resolves the opaque server-held episode identity against a fresh bounded feed, discovers the explicit official transcript link from its official episode page, then extracts only `article.single-post` into ordered speaker-aware turns. Missing selectors, non-HTTPS/external transcript links, unsafe redirects, non-HTML responses, and size limits fail closed.

The transcript and selected passage remain browser-memory/session data. Native publisher audio uses a direct `<audio preload="none">`; it is never proxied or persisted. Deterministic passage segmentation is client-safe and respects speaker/paragraph text and sentence boundaries where possible, with a 300-word hard limit. A selected passage, not the transcript, is converted to sanitized `Content` and can follow the existing explicit lesson path; M7 adds no provider capability.

## M8 progress and learning analytics

M8 is a client-only derived-data flow. A typed loader consumes the existing public browser-local store interfaces, isolates any rejected source read with `Promise.allSettled`, and passes typed evidence to a pure `src/domain/progress.ts` aggregator. The domain accepts injected `now`, selected range, and learner browser IANA timezone; it has no Next.js, storage, provider, server, or network dependency. The `/progress` route contains no API fetch, and it writes neither a calculated snapshot nor an analytics event.

```
LessonStore / WritingSessionStore / ErrorMemoryStore / ReviewStore / ListeningStore
                                      |
                            typed read-only source data
                                      |
                         buildProgressSnapshot(now, range, timezone)
                                      |
                                browser-local Progress UI
```

Completed event metrics use lesson `createdAt`, writing-session `createdAt`, optional explicit revision `revisionReviewedAt`, review `reviewedAt`, dictation `attemptedAt`, and shadowing `repeatedAt`. Invalid or future dates are excluded without substitution. Error patterns and current ReviewItems are current-state evidence rather than historical snapshots; M8 therefore never fabricates lifecycle transitions, missed reviews, or a proficiency score. The listening comparison is a bounded activity-evidence comparison, not a listening-level assessment.

## M9 daily learning hub and local library

M9 remains client-local and read-only at its aggregation boundary. Existing local stores feed one typed loader, which produces Home/Library view data; no `HomeStore`, dashboard store, provider capability, background fetch, or cloud repository is introduced. Root `/` is Home, `/discover` keeps the accepted curated-fetch experience, `/add-content` is the manual intake route, and `/my-content` redirects for compatibility. The shared client shell owns accessible route labels and active-route state; server-only provider and source modules are never imported into it.

`StoredLessonContext` is optional and schema-validated on every LessonStore read. For new lessons it retains the exact canonical `buildLessonSource()` text (maximum 12,000 sanitized plain-text characters) plus minimal metadata. `/library/lessons/[lessonId]` reads this browser-local lesson and presents generated material without a provider, feed, article, transcript, or generation request. Context-free legacy lessons still expose their generated material and listening compatibility; they do not reconstruct a source. A validated context is the only resumed-writing source accepted by the server boundary, preserving M3 source grounding without duplicating complete publisher content in WritingSessionStore.

## M10 phrase and vocabulary SRS

M10 adds a separate client-only `VocabularyReviewStore` alongside PhraseStore, not a second use of M4 Error Pattern Review. Its pure domain scheduler accepts `VocabularyReviewItem` state and a learner outcome, and returns only the next item plus a metadata-only `VocabularyReviewEvent`. Item identity is the durable phrase ID; PhraseStore remains the source of phrase/context/source information. The `/vocabulary` route reads those two local stores, chooses at most ten due items by `dueAt` then `phraseId`, and uses a locally generated exact-context cloze or source-recall fallback. No server module, provider capability, API route, feed, article, transcript, or lesson generation is imported or contacted.

`VocabularyReviewStore` keeps a versioned bounded envelope (200 items, newest 1,000 events) and validates all state with Zod. Corrupt data is an empty read-only fallback without clearing raw browser data. Explicit review removal deletes just one item/event history. Coordinated phrase deletion first attempts vocabulary cleanup and blocks phrase deletion on cleanup failure, so ordinary read paths never mutate either store. Progress derives vocabulary metrics from the same state without adding vocabulary to M8’s Lesson/Writing/Review/Listening balance dimensions.

## M11 IELTS-style foundations

M11 adds a framework-independent `src/domain/ielts.ts` plus a dedicated versioned browser-local `IeltsPracticeStore`; it does not alter LessonStore, WritingSessionStore, ErrorMemoryStore, or the existing Review stores. `/ielts`, `/ielts/reading/[practiceId]`, and `/ielts/writing/[sessionId]` load local state only. Current ReadingView and eligible saved lesson contexts expose explicit creation actions; legacy lessons without context remain local but cannot reconstruct or refetch a Reading source.

```
sanitized Content / StoredLessonContext -- explicit action --> /api/ielts/reading/*
                                                        --> server-only provider capability
                                                        --> strict domain validation
                                                        --> browser-local IeltsPracticeStore

Task 2 local draft -- explicit Analyze / Review --> /api/ielts/writing/analyze
                                                --> server-only provider capability
                                                --> strict domain validation + ErrorMemoryStore
```

The two capabilities (`ielts_reading_generation`, `ielts_writing_feedback`) reuse the configured lesson model and existing transient retry boundary. Both Gemini and OpenAI adapters return structured output, which is validated by the canonical domain before a client can persist it. They have no tools, web search, URL context, code execution, or external exam API. Progress reads the new local store alongside existing sources; IELTS remains a separate evidence section and active-day contributor, not an M8 Learning Balance dimension or assessment engine.
