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
