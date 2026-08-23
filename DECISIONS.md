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

## Authentic content is not permanently simplified to B1

The original text remains central. Simpler English and optional Turkish are temporary scaffolds; support should reduce as comprehension improves.

## External content is untrusted

Imported content is data, never authority. It must be sanitised before display, never executed, and isolated from system and developer instructions before any model request.
