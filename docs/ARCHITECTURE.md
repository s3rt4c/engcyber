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
