# EngCyber

EngCyber is a private English-learning web application for progressing from B1 toward B2 / early C1 and IELTS Band 7.0. It centres authentic cybersecurity and AI material, while retaining room for general IELTS content.

## M3 status

M3 adds an explicit two-attempt writing-learning loop inside generated lessons. The learner writes first, explicitly requests concise structured feedback, revises independently, then explicitly requests a comparison. High-confidence validated errors become browser-local Personal Error Memory; the app does not evaluate text while the learner types or opens a lesson. Gemini is the current personal runtime; OpenAI remains an optional supported provider.

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
- `src/server`: server-only source discovery, safe fetching, sanitization, AI-provider, and Supabase seams.
- `src/client`: versioned browser-local lesson, phrase, writing-session, and error-memory adapters.
- `docs`: the M0 architecture and database proposal.

Read [ROADMAP.md](ROADMAP.md), [DECISIONS.md](DECISIONS.md), and [docs/DATABASE_MODEL.md](docs/DATABASE_MODEL.md) before expanding a product workflow.
