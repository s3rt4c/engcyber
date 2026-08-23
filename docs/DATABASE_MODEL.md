# Database and domain model proposal

M0 defines types only. M1 deliberately adds no PostgreSQL migrations: saved phrases use a browser-local `PhraseStore` adapter until cross-device persistence, authentication, or multi-user support is needed.

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
| `review_items` | Scheduled phrase/error review work. | Future belongs to `users`. |
| `voice_session_reports` | Imported external speaking summaries. | Future belongs to `users`; contributes occurrences. |
| `progress_snapshots` | Periodic, evidence-based metrics. | Future belongs to `users`. |

Every learner-owned table should receive a nullable-then-required `user_id` migration when multi-user support begins. M0 remains single-user and avoids premature authentication.

Raw extraction output is an in-memory boundary, not a renderable content record. M1 must sanitise it before storing `contents`; it should keep only the minimum audit data necessary for troubleshooting. A later M2 implementation can cache reusable sentence actions with a sentence/action fingerprint without adding that persistence shape during M0.
