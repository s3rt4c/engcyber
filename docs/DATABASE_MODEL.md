# Database and domain model proposal

M0 defines types only. M1 deliberately adds no PostgreSQL migrations: saved phrases use a browser-local `PhraseStore` adapter until cross-device persistence, authentication, or multi-user support is needed. M2 uses the same temporary approach for a versioned browser-local `LessonStore`; no Supabase migration is introduced.

M3 still adds no PostgreSQL migration. It introduces browser-local `WritingSessionStore` and `ErrorMemoryStore` contracts designed for later Supabase replacement. `writing_sessions` would retain lesson/content identity, the first and revised drafts, validated feedback, and timestamps; it must not duplicate article bodies. `error_occurrences` would retain the validated taxonomy, application-derived pattern key, correction/dismissal state, confidence, and attempt/session identity. `error_patterns` remains a derived aggregation with deterministic lifecycle and priority, not provider-owned state. The local MVP keeps the newest 50 sessions, 200 occurrences, and 100 derived patterns.

M4 also adds no PostgreSQL migration. Its separate browser-local `ReviewStore` would later map to `review_items` and `review_events`: one `error_pattern` item per active pattern, deterministic stage/due/lapse state, and metadata-only events. It stores neither article bodies nor review answers. Phrase review has no persistence shape in M4 and remains deferred.

M5 also adds no PostgreSQL migration. Its separate browser-local `ListeningStore` would later map to `listening_sessions`, `listening_exercises`, `listening_attempts`, and `shadowing_events`: selected bounded exercise sentences, compact alignment counts/status, and explicit repetition timestamps. It does not store full article text, raw learner dictation, provider responses, speech recordings, or pronunciation scores. The local MVP retains 20 sessions and 200 combined attempt/shadowing events.

M6 adds no persistence or migration. The curated source registry is application configuration; feed results are transient bounded metadata returned by discovery. A future `sources` table may mirror only stable registry identity and attribution if product needs justify it, while `feed_items` remains metadata-only and must preserve `source_id` plus application-controlled source display attribution. Full publisher article bodies are still not archived by discovery.

M7 also adds no persistence or migration. `PodcastEpisode` metadata and `TranscriptDocument`/speaker turns are transient request or browser-session values, not a transcript archive. A future model could add bounded podcast source/episode metadata only if a product need arises; it must not turn third-party transcript text, audio bytes, or transcript HTML into durable storage without a separate rights, retention, and product decision.

M8 adds no persistence or migration. `ProgressSnapshot` is computed on demand from the bounded local stores and is never stored as a second source of truth. The existing `progress_snapshots` row below remains a future table concept only, appropriate only after a separate user, retention, privacy, and cross-device decision. M8 adds optional `revision_reviewed_at` only to the browser-local writing-session contract for newly completed explicit revision reviews; legacy sessions retain no inferred value.

M9 still adds no PostgreSQL migration. `StoredLessonContext` is an optional browser-local field for newly created lessons, not a `contents` archive: it retains the exact bounded (12,000-character maximum) sanitized generation source and minimal identity/source metadata needed for local resume. `WritingSession` continues to reference `lesson_id`; it does not copy this context or article body. `SavedPhrase` gains a durable local record `id`, while its duplicate signature remains a separate ingestion rule. A future Supabase mapping may preserve those stable IDs and relationships once cross-device persistence/authentication is approved; M9 adds no cloud sync, account, export, or retention service.

M10 also adds no migration. Its browser-local `VocabularyReviewStore` would later map to separate `vocabulary_review_items` and `vocabulary_review_events` tables. Each item references `user_phrases.id` only and owns stage/status/due/counters; each event contains metadata-only outcome and transition fields. It does not duplicate phrase text/context/source, answers, provider output, or generic Error Pattern Review fields. The local MVP retains at most 200 items and newest 1,000 events.

M11 adds no migration. Its dedicated browser-local `IeltsPracticeStore` retains at most 30 validated Reading practices and 30 Task 2 sessions. A future mapping may introduce separate practice/session rows that reference existing `contents` or lessons by stable identity; it must not archive publisher article bodies, full transcripts, raw provider responses, or invent scores. Reading records contain bounded generated questions, selected answer IDs, completion evidence, optional elapsed seconds, source identity/fingerprint, and a generation fingerprint. Task 2 records contain the application-owned prompt ID/type, drafts, validated qualitative feedback, timestamps, and optional elapsed seconds. High-confidence language issues continue to use existing `error_occurrences` rather than an IELTS-specific error table.

M0–M12 are accepted and merged. M12 evolves that browser-local envelope in memory to independently retain up to 30 Listening sessions. A valid M11 Reading/Writing envelope reads unchanged with an empty Listening collection until an explicit successful save writes the new version. Each Listening session stores only its durable ID, immutable application-owned practice-definition ID, answer values keyed by question ID, successful playback metadata, deterministic score metadata, and timestamps. It never duplicates an authored script/transcript, browser audio, microphone data, recordings, or a provider result. Listening retention orders sessions by `updatedAt` and then ID, evicting only excess Listening records. This remains a browser-local migration point, not a cross-device database.

M13 adds no database table or migration. A single portable browser backup manifest groups the existing eight localStorage store payloads under explicit format/app-data versions; it is neither a new persistence store nor cross-device sync. Restore serializes back into those same existing envelopes only after full schema/cap/reference validation. The manifest intentionally excludes browser settings, provider configuration, authentication, secrets, cache, and unrelated origin keys.

M14 adds no database table, browser-local key, envelope field, migration, manifest section, or backup version. Its continuation and completed IELTS activity items are pure transient projections of the existing Reading, Writing Task 2, and Listening collections inside `IeltsPracticeStore`. Their IDs are derived from durable practice/session IDs plus event state, so links remain valid after reload without persisting presentation state. A future cross-device model may derive the same projections from the existing IELTS rows; it must not create a second history or continuation table merely to cache these views.

| Table | Purpose | Important relationships |
| --- | --- | --- |
| `sources` | Configured source identity, adapter kind, and optional endpoint. | One-to-many `feed_items`. |
| `feed_items` | Cheap discovery metadata. | Belongs to `sources`; can become one `contents` record. |
| `contents` | Sanitised study content plus a content fingerprint. | `feed_item_id` is nullable for manual intake; has many `lessons`. |
| `lessons` | User-requested generated learning material. | Belongs to `contents`; a generation fingerprint supports reuse. |
| `lesson_sentences` | Original and support text per sentence. | Belongs to `lessons`. |
| `lesson_phrases` | Phrases exposed in a lesson. | Joins `lessons` and phrase data. |
| `user_phrases` | Saved phrases and active/passive knowledge state. | Future belongs to `users`. |
| `reading_attempts` / `writing_attempts` | Activity and response evidence. | Future belongs to `users` and optional `lessons`. |
| `error_patterns` | Stable recurring pattern keys and lifecycle. | Future belongs to `users`; has many occurrences. |
| `error_occurrences` | Evidence for an error pattern. | Belongs to `error_patterns` and an activity. |
| `review_items` | Scheduled Error Pattern review work in M4. | Future belongs to `users`; `source_type` supports a later phrase source without unifying domains now. |
| `listening_sessions` / `listening_exercises` / `listening_attempts` / `shadowing_events` | Browser-local M5 listening practice evidence. | Future belongs to `users`; exercises retain only selected bounded sentence text and attempts exclude typed dictation. |
| `voice_session_reports` | Imported external speaking summaries. | Future belongs to `users`; contributes occurrences. |
| `progress_snapshots` | Periodic, evidence-based metrics. | Future belongs to `users`. |

Every learner-owned table should receive a nullable-then-required `user_id` migration when multi-user support begins. M0–M2 remain single-user and avoid premature authentication.

Raw extraction output is an in-memory boundary, not a renderable content record. M1 must sanitise it before storing `contents`; it should keep only the minimum audit data necessary for troubleshooting. Reusable sentence-action caching with a sentence/action fingerprint remains a later optimisation and does not add a persistence shape during M2.
