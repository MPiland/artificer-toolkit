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

**User (2026-10-15):** agrees in principle, but `ass_muncher` and `AssMuncher` must still be refused. Asked for the best practice.

**Refined recommendation (tiered; the usual answer to the "Scunthorpe problem"):**

1. **Normalize:** lowercase, digit and look-alike swaps (`a55` to `ass`), collapse repeats.
2. **Split into tokens** on `_`, on lower-to-upper case changes and on letter-digit changes. Refuse any token on the blocklist. `ass_muncher`, `AssMuncher` and `Ass1Muncher` are refused; `Cassandra` is one token and passes.
3. **Substring tier for unambiguous terms only:** slurs and stems that never occur inside ordinary words are refused anywhere, even inside one unbroken token (`xxslurxx`). Short ambiguous terms (`ass`, `dick`, `cum`, `tit`) stay token-only.
4. **Allowlist of known false positives** for the substring tier, maintained with the list.
5. **Backstop:** reports and a moderator rename.

Gap: an all-lowercase compound such as `assmuncher` is one token, and its term is ambiguous, so tiers 2 and 3 miss it. Closing that needs dictionary segmentation (refuse when the name splits into a blocked word plus real words, which `cassandra` does not). Do that server-side only, so the client bundle does not carry a dictionary. Evaluate the maintained `obscenity` npm library first (blocklist, allowlist and leetspeak handling) before building our own.

**Answer:**
