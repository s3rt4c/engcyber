# M18 Local Daily Training Queue Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans and test-driven-development; use one independent read-only review before acceptance.

**Goal:** Prioritize at most three existing actionable learning workflows on Home.

**Architecture:** The existing one-pass local loader remains authoritative. Reuse Review eligibility, Progress calendar counts, Library writing actions, IELTS continuation, and M5 listening selection. A pure domain selector ranks/deduplicates the accepted candidates. Home reads through the existing adapters with writes disabled, including malformed-storage cleanup.

**Tech Stack:** Existing TypeScript, React/Next 16.4.1, Vitest, Playwright; no dependencies.

**Spec:** User-approved M18 implementation brief, attachment `14081a8e-398a-4171-bf95-ceb2a5610f0a`.

## Global constraints

- Start at clean `codex/m18-local-daily-training`, exact main `000214ac9b892888c4f566c0da21d9c2d616a70a`.
- Derived state only: no key, store, migration, event, completion checkbox, provider/API/network addition, or backup change.
- Preserve Focus and existing Home navigation, M16/M17, dependency/security policy and deferred deployment.
- Priority: overdue Review, overdue Vocabulary, due Review, due Vocabulary, Writing, IELTS, M5 Listening. Deduplicate canonical hrefs; max three.
- Retain accepted continuation ordering, with stable timestamp/ID ties. Reject future-invalid and ownerless work without writing repairs.
- Commit/push/open one PR only after acceptance; do not merge or deploy.

## Tasks

### 1. Pure ranking and Home derivation

- [x] Write selector tests for all priority tiers, bounds, duplicates, immutable input and stable ties; observe RED.
- [x] Write real-store integration tests for stale owners, completed/future records, local timezone boundaries and read-only malformed storage; observe RED.
- [x] Expose existing Review eligibility and Progress review-count helpers without semantic changes.
- [x] Implement `src/domain/daily-training.ts`; wire `trainingQueue` into `buildDailyHub` and reuse existing store validation through a read-only Home adapter boundary.
- [x] Run focused tests and existing authority regressions; observe GREEN.

### 2. Home and browser acceptance

- [x] Write static-render tests for the real Home content, reasons/semantic links/empty state/preserved sections; observe RED.
- [x] Add the compact primary training section and preserve existing detailed sections.
- [x] Add one isolated Chromium test: mixed local state, read-only Home, keyboard link to Review, explicit local review, return/reload and recomputed order.
- [x] Keep six total E2E tests, zero retries, existing network guard and no provider secrets.

### 3. Acceptance and publication

- [x] Update README/ROADMAP M18 and stale status wording only in the relevant sections.
- [x] Run focused/full Vitest, lint, typegen, typecheck, build, six E2E, full/production audit, backup/security invariants and diff checks.
- [x] Independently review ranking, calendar boundaries, stale targets, mutations/network, privacy/backup/security, accessibility and wording; fix material findings and rerun affected gates.
- [ ] Commit meaningful implementation and documentation changes, push the requested branch, open one PR and observe CI. Stop before merge/deployment.

## Review focus

- A stale Review item must have a live eligible error owner; a deleted phrase must not inflate vocabulary work.
- Malformed legacy storage must remain byte-for-byte unchanged on Home, even when an adapter normally repairs it.
- Equal timestamps and shuffled input must not change continuation order.
- Future records must not hide an older valid continuation; completion must remove only the completed work.
- Returning to Home must derive current work rather than create persisted queue state; reasons must describe actual evidence.

## Local acceptance (2026-10-24)

79 Vitest files / 381 tests; focused M18 3 files / 30 tests; six Chromium tests / zero retries against production Next 16.4.1. Lint, route type generation, typecheck, build, full and production audits passed. Both audits report zero active findings. Package files, backup v1/eight domains and M16/M17 boundaries remain unchanged. Production dependency graph excludes the retained lint chain; 36 output traces contain none of it.

Independent review initially identified two canonical-target mismatches. Three regression tests reproduced them before correction. Writing now shares its destination lookup with an explicit timestamp/ID tie; Listening reuses the existing destination session selector before time qualification. Re-review: zero Critical, Important or Minor findings. Publication follows the authorized task procedure; the PR records its final state. No merge or deployment is authorized.
