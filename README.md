# EngCyber

EngCyber is a private English-learning web application for progressing from B1 toward B2 / early C1 and IELTS Band 7.0. It centres authentic cybersecurity and AI material, while retaining room for general IELTS content.

## M12 status

M3 adds an explicit two-attempt writing-learning loop inside generated lessons. The learner writes first, explicitly requests concise structured feedback, revises independently, then explicitly requests a comparison. High-confidence validated errors become browser-local Personal Error Memory; the app does not evaluate text while the learner types or opens a lesson. Gemini is the current personal runtime; OpenAI remains an optional supported provider.

M4 adds a separate browser-local ReviewStore for Personal Error Memory patterns only: deterministic 1/3/7/14-day correction and free-production practice, local-first grading, and explicit provider-neutral checking only for non-identical or free-production answers. Saved phrases remain unchanged; phrase and vocabulary SRS are deliberately deferred.

M5 adds browser-local Listening Practice for saved lessons: up to five deterministic authentic sentences, browser SpeechSynthesis playback, local dictation scoring, and unscored shadowing repetitions. Listening uses no AI/provider calls, does not retain typed dictation after grading, and keeps its own bounded `ListeningStore` separate from LessonStore and ReviewStore. SpeechSynthesis invocation, cancellation, rate handling, and replay safety are tested; physical audible output depends on the learner's browser and OS audio environment.

M6 expands Discover to four application-controlled official feeds: CISA Cybersecurity Advisories, Hugging Face Blog, SANS ISC Handler's Diary, and Google Cloud Threat Intelligence. Discovery fetches only bounded RSS/Atom metadata server-side, preserves application-controlled source attribution, isolates per-source failure, and supports local category/source/sort controls. Article bodies remain on-demand through the existing safe fetch, extraction, and sanitisation path; discovery, filtering, and article opening call no AI provider.

M7 adds one curated podcast source, Darknet Diaries. It lists only bounded official numbered-episode metadata, plays publisher audio directly with native browser controls, and discovers a transcript only after the learner explicitly requests it. Transcript HTML and audio bytes are never persisted; only a learner-selected bounded study passage may enter the existing explicit lesson flow.

M8 is accepted: its browser-local `/progress` view derives activity evidence from existing lesson, writing, Error Memory, review, and listening records without provider, network, telemetry, or stored analytics snapshots.

M9 is accepted. `/` is the action-first Daily Learning Hub, curated discovery lives at `/discover`, and `/library` lists browser-local lessons and saved phrases. A new `/library/lessons/[lessonId]` page opens cached generated material without recreating a publisher article. Newly saved lessons retain the exact 12,000-character-or-less canonical sanitized lesson source used for generation; older lessons remain usable but explicitly degrade where source-dependent writing cannot be resumed. Home, Library, phrase listing, and cached lesson detail make no provider, feed, article, transcript, or lesson-generation request.

M10 is accepted. `/vocabulary` is a separate browser-local Phrase & Vocabulary SRS, entered only when the learner explicitly adds a saved phrase. It uses deterministic 1/3/7/14/30/60-day retrieval scheduling, context cloze or source-attribution recall, conservative local exact-answer checking, and metadata-only review events. Vocabulary items reference durable `SavedPhrase` IDs and stay separate from M4 Error Pattern Review.

M0–M13 are accepted and merged. M13 adds browser-local, versioned Data & Backup at `/backup`: it exports only the eight current learner-data stores as a validated JSON file and restores only after a local preview and explicit replacement confirmation. It performs no network request, provider call, or automatic backup; import validates the whole manifest before a transactional, read-back-checked local restore with rollback on failure. `/ielts` provides non-official IELTS-oriented Reading, Writing Task 2, and Listening practice. Reading uses an explicit server-only structured generation request from a bounded sanitized source (400 words minimum; the existing 12,000-character source bound), generates exactly three multiple-choice plus three True / False / Not Given questions, validates each bounded source excerpt, caches compatible practices locally, and grades answers locally. Task 2 uses one of twelve application-owned prompts, local drafts/timers, four qualitative criteria, bounded language feedback using the existing Error Memory taxonomy, and explicit initial/revision requests only. It never calculates a band, CEFR level, readiness, or examiner score. Opening IELTS, Home, Library, Progress, Reading practice, or Writing practice makes no provider request; only explicit create/analyze/review actions may do so.

M11 acceptance note: two separate UI-triggered Reading attempts reached Gemini, exhausted the existing bounded transient retry path, and returned temporary-unavailability errors without saving malformed or partial practice. Writing live calls were not attempted under the accepted stop rule. This is an external provider-availability limitation, not a successful live-provider verification; automated and non-live verification remain green, and no retry, schema, or provider behavior was weakened.

M12 adds `/ielts/listening`: exactly eight original application-owned mini-practices, two in each IELTS-oriented part-style label, with six deterministic local questions per practice (three multiple choice and three completion). Browser SpeechSynthesis plays structured script turns at 1.0x and permits replay; the browser-local listening sessions retain at most 30 attempts, reveal the authored transcript and explanations only after explicit completion, and contribute concrete Listening evidence, Active Days, and one existing Learning Balance Listening activity per completed session. It uses no AI, no network audio, no microphone APIs, and no speaking feature. SpeechSynthesis invocation and `onstart` were verified, but physical audible output was not independently verified by browser automation; this is the non-blocking M12 PASS WITH NOTE. Speaking practice remains external to EngCyber through ChatGPT Live / Voice.

M0–M14 are accepted and merged. M14 adds bounded, reload-safe IELTS continuation and activity views without new persistence, provider calls, scores, or Speaking features.

M15 is accepted. Playwright runs four provider-free Chromium critical paths against a production `next start` server: Backup download/restore, IELTS continuation/reload, IELTS activity/Progress, and Reading phrase-to-Vocabulary. Every test has an isolated synthetic browser context, fails external HTTP(S) product traffic, requires no provider secret, and retains trace/screenshot evidence on failure. Vitest remains authoritative for domain behavior; M15 does not prove physical audio output or add product persistence.

M16 is accepted. It adds an application security envelope: bounded JSON bytes, JSON media-type and same-origin checks on every POST API route, safe normalized API errors, `no-store` API responses, baseline non-CSP headers, safe external-link rendering, and bounded provider attempts. M17 makes the repository ready for a Vercel origin behind Cloudflare Access with origin-side Access JWT verification and Upstash Redis abuse controls. AI concurrency limits admitted EngCyber operations; Gemini work may outlive client-side timeout/cancellation. **The repository is ready for the selected private-deployment architecture, but external Cloudflare Access, DNS, Vercel production configuration, Upstash production state, HSTS, CSP measurement, and deployment smoke acceptance are still pending.** EngCyber is not a public SaaS and unauthenticated public deployment remains unapproved.

The core flow is deliberately on demand: `discover metadata -> learner opens content -> optional sentence help -> learner requests lesson`. Discovery and ordinary reading never generate a lesson.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add local Supabase values and set `AI_PROVIDER` to `gemini` or `openai` with that provider's required variables. Never commit `.env.local`.
3. Run `npm run dev`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm test` | Run Vitest once. |
| `npm run build` | Build the production application. |

## Project map

- `src/app`: App Router pages and server route handlers.
- `src/domain`: framework-independent models and feature boundaries.
- `src/server`: server-only source registry/discovery, safe fetching, sanitization, AI-provider, and Supabase seams.
- `src/client`: versioned browser-local learning stores plus read-only Home/Library loaders and browser-speech adapters.
- `docs`: the M0 architecture and database proposal.

Read [ROADMAP.md](ROADMAP.md), [DECISIONS.md](DECISIONS.md), and [docs/DATABASE_MODEL.md](docs/DATABASE_MODEL.md) before expanding a product workflow.
