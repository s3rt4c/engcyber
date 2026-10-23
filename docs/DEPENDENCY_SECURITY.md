# Dependency security baseline

Initial remediation on 2026-10-22; final advisory review on 2026-10-24. This is a
security-maintenance prerequisite. M18 has not started, and no external
deployment or live provider acceptance is included.

## Remediation

| Package | Previous | Accepted resolution | Ownership |
| --- | --- | --- | --- |
| `next` | 16.3.3 | 16.4.1 | Direct runtime dependency; smallest 16.x release fixing GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr |
| `eslint-config-next` | 16.3.2 | 16.4.1 | Direct development dependency, aligned with Next |
| `sharp` | 0.35.3 | 0.35.5 | Next's optional runtime image dependency |
| `source-map-js` | 1.2.1 | 1.2.2 | Next/PostCSS and Tailwind build dependency paths |
| `undici` | 7.29.0 | 7.30.1 | Cheerio's transitive runtime dependency |
| `zod` | 4.4.3 | 4.6.6 | Direct runtime dependency; fixes GHSA-mrhx-c7xc-m3w5, newly reported by the resumed audit |

Normal compatible resolution also updates the newly reported development-tool
findings: `vitest` and its internal packages to 4.1.12, `vite` to 8.3.5,
`js-yaml` to 4.3.2, and `brace-expansion` to 1.1.21 / 5.0.12. Vite/Vitest's
existing dependency ranges select their associated PostCSS, Rolldown, native
bindings and utility updates. Next/Sharp platform packages follow their parents.
React remains 19.2.8. There are no new direct transitive dependencies, overrides,
forks, manual package patches or force-fixes. Installation scripts were disabled
during the local dependency update and isolated production installation.

The affected installed framework version did not by itself prove an exploitable
EngCyber path. Source review found no application use of `next/og` ImageResponse,
`next/image`, or `use cache`; this was not used to waive the framework update.

## Audit results

Counts are npm's affected-package counts, not independent exploit counts.

| Graph | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| Initial full lockfile, 2026-10-22 | 1 | 11 | 2 | 0 |
| Initial `--omit=dev`, 2026-10-22 | 1 | 3 | 0 | 0 |
| After framework/tooling updates, full, 2026-10-22 | 0 | 5 | 0 | 0 |
| After framework/tooling updates, `--omit=dev`, 2026-10-22 | 0 | 0 | 0 | 0 |
| Resumed audit before Zod update, full and `--omit=dev`, 2026-10-24 | 0 | 1 | 0 | 0 |
| Final full lockfile (`--include=dev`), 2026-10-24 | 0 | 0 | 0 | 0 |
| Final `--omit=dev`, 2026-10-24 | 0 | 0 | 0 | 0 |
| Clean isolated `npm ci --omit=dev` installation, 2026-10-24 | 0 | 0 | 0 | 0 |

The five high findings reported on 2026-10-22 were one advisory propagated
through this development-only chain, not five independent vulnerabilities:

```text
eslint-config-next@16.4.1
  -> @next/eslint-plugin-next@16.4.1
  -> fast-glob@3.3.1
  -> micromatch@4.0.8
  -> braces@3.0.3
```

## Braces disposition C: retained development-only dependency

Disposition **C: still present, dev/build only**. The bounded temporary-risk
acceptance recorded on 2026-10-22 did not claim that `braces` was fixed.
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
was withdrawn on 2026-10-23 because it was not practically exploitable. The
registry's latest release remains 3.0.3 and the advisory lists no patched
release: withdrawal is not a package patch. Fresh full and production audits
now both exit zero without suppressing or filtering any advisory.

The resumed audit separately reported high-severity
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) for
runtime Zod below 4.6.6. Updating the existing direct dependency to 4.6.6 closed
that finding. The dated audit rows above preserve this change in advisory state.

The normal parent upgrade to the matching Next lint package did not remove it.
The official 16.4.2 lint plugin also still pins `fast-glob@3.3.1`; latest
`fast-glob@3.3.3` still uses `micromatch`, whose latest 4.0.8 still requires
`braces`. Switching this parent to a different glob implementation would require
an upstream change or a fork. The audit's suggested Next lint downgrade is not
accepted as a compatible security fix. No replacement or invented patch is used.
Those parent/alternative checks were performed on 2026-10-22.

Evidence and compensating scope:

- A separate clean production-only installation contains neither `braces` nor
  `eslint-config-next`; its production audit reports zero findings.
- All 36 local production output-file traces contain no files from `braces`,
  `micromatch`, `fast-glob`, or the Next lint packages.
- Application source imports none of those glob packages. No HTTP, imported
  article, learner text or provider output reaches this lint dependency chain.
- The inspected lint callsite reads repository-controlled Next `rootDir`
  settings; this repository supplies no custom `rootDir` glob. Lint runs against
  repository-controlled files/configuration, not a public glob-processing API.
- Keep tooling in trusted local/CI execution. Production packaging must use the
  production dependency graph or traced runtime files, never copy the complete
  development `node_modules` tree. Retain full audits without global suppression.

Retain the packaging and trusted-tooling boundary and review it by
**2026-11-05**, or earlier when a supported parent replacement becomes available,
dependencies change, deployment packaging is selected, or any user-controlled
glob/runtime use is introduced. The withdrawn advisory is no longer a remaining
active audit finding; the zero result is dated evidence, not a guarantee against
future disclosures or a claim that the retained package was patched.

M16/M17 controls, provider behavior, browser-local learner storage and
`engcyber-backup` v1 are unchanged. Local artifact evidence does not certify a
future external deployment or replace its packaging and security acceptance.
