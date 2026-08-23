# EngCyber

EngCyber is a private English-learning web application for progressing from B1 toward B2 / early C1 and IELTS Band 7.0. It centres authentic cybersecurity and AI material, while retaining room for general IELTS content.

## M0 status

M0 establishes the Next.js application shell, typed domain model, safety-conscious integration boundaries, environment contract, and tests. It does not ingest sources, call OpenAI, persist data, or generate lessons.

The core flow is deliberately on demand: `discover metadata -> learner selects content -> request lesson -> future AI lesson generation`. Discovered content is metadata-only. A full lesson is never generated merely because a feed item appears.

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

- `src/app`: the minimal application shell.
- `src/domain`: framework-independent models and feature boundaries.
- `src/server`: server-only environment, OpenAI, and Supabase seams.
- `docs`: the M0 architecture and database proposal.

Read [ROADMAP.md](ROADMAP.md), [DECISIONS.md](DECISIONS.md), and [docs/DATABASE_MODEL.md](docs/DATABASE_MODEL.md) before expanding a product workflow.
