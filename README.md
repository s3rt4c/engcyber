# EngCyber

EngCyber is a private English-learning web application for progressing from B1 toward B2 / early C1 and IELTS Band 7.0. It centres authentic cybersecurity and AI material, while retaining room for general IELTS content.

## M1 status

M1 adds metadata-only discovery from CISA and Hugging Face Blog, safe server-side article import, manual URL/text intake, an authentic reading view, explicit sentence actions, browser TTS, and browser-local saved phrases. It does not generate lessons, add database persistence, or begin M2.

The core flow is deliberately on demand: `discover metadata -> learner opens content -> optional sentence help -> future learner-requested lesson`. Discovered content is metadata-only. A full lesson is never generated merely because a feed item appears.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add local values for Supabase and OpenAI. Never commit `.env.local`.
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
- `src/server`: server-only source discovery, safe fetching, sanitization, OpenAI, and Supabase seams.
- `docs`: the M0 architecture and database proposal.

Read [ROADMAP.md](ROADMAP.md), [DECISIONS.md](DECISIONS.md), and [docs/DATABASE_MODEL.md](docs/DATABASE_MODEL.md) before expanding a product workflow.
