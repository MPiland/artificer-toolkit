# Phase 8.2 open questions

> Questions waiting for the user's answer only; keep this file short. Answer inline under **Answer** (or in chat). Answered items move to [Resolved](phase-08-2-decisions.md#resolved) with the decision; decisions made on the user's behalf, approved implementation decisions and resolved questions live in [phase-08-2-decisions.md](phase-08-2-decisions.md).
>
> Updated: 2026-10-15.

## Open

### Q22: the username filter rejects ordinary names (2026-10-15)

`validateUsername` (`packages/shared/src/domains/account/usernamePolicy.ts`) checks for profanity anywhere inside the name, and checks it a second time after turning digits into letters (5 to s, 1 to i, and so on). As a result it rejects `Cassandra`, `Classic`, `Dickens`, `Essex`, `Glasshouse` and `Assassin`. It also rejected a random test name, `Journey_a55b…`, which made `accountJourneys.test.ts` fail by chance in CI (PLATFORM-13.T7).

Options:

- **(a) Keep the substring match.** Strongest filter, but a real share of ordinary names are refused with "That username isn't allowed." and no reason.
- **(b) Match whole segments.** Split the name on `_` and between letters and digits, and reject a segment that is a listed word, with and without the digit swap. `Cassandra` passes, and so does a slur run together with other letters (`xxSlurxx`). Embedded cases are left to reporting and moderation.
- **(c) Substring match plus an allowlist of common words.** Keeps (a)'s strength, but the list never ends and must be maintained.

Recommendation: **(b)**. Refusing common names at signup is a first-impression cost for every affected player, and the embedded slurs that (b) misses are what reporting covers anyway.

**Answer:**
