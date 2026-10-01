# Phase 8.2 open questions

> Questions waiting for the user's answer only; keep this file short. Answer inline under **Answer** (or in chat). Answered items move to [Resolved](phase-08-2-decisions.md#resolved) with the decision; decisions made on the user's behalf, approved implementation decisions and resolved questions live in [phase-08-2-decisions.md](phase-08-2-decisions.md).
>
> Updated: 2026-10-01.

## Open

### Q20 Web app on Cloudflare (D65): three choices

The feasibility check is [the D65 record](../validation/phase-08-2/d65-cloudflare-web-hosting-2026-09-28.md). Its verdict is **go with conditions**: TanStack Start supports Workers, the changes are small, and requests fit Workers Free with plenty of room (about 8% of the daily pool on an average Q16 day, 22% at peak). Three choices are yours:

1. **Signed-in pages without server rendering.** The free plan allows 10 ms of CPU per request. Anonymous pages render in about 2–8 ms, but signed-in pages are estimated at 10–40 ms (not yet measured on Workers).
   - **Recommendation:** render signed-in pages in the browser (`ssr: false` on `_authed`), whatever the staging measurement shows.
   - **Why:** it costs $0. It removes duplicated Convex queries (today SSR runs the same queries the browser then subscribes to). And it matches how Foundry and Roll20 work (single-page apps).
   - **Trade-off:** signed-in pages show a brief app shell before data arrives. Public and marketing pages keep server rendering, which search engines need.
   - **Alternative:** Workers Paid at `$5` a month.
2. **Stop refetching the session on tab refocus.** Better Auth re-fetches the session every time a tab regains focus; that is its default and the biggest web request driver. The recommendation is to turn it off. Sessions are still checked on navigation and by each server call, so security doesn't change.
3. **When the daily request pool runs out** (bots and scanners are the real risk): the recommendation is to turn on Cloudflare's free Bot Fight Mode and fail closed, meaning requests are refused until midnight UTC rather than billed.
   - **Worth knowing:** the same pool serves live tables.
   - **The plan:** an alert at 60% of the daily pool.

**Answer (user, 2026-09-28):** Move to Cloudflare. A beta will test the real load. No paid plan: the user cannot fund monthly hosting before revenue. Protection against exhaustion comes from free measures (per-user rate limits, Bot Fight Mode, an early alert) plus beta measurement, not from paying. Choices 1 (SSR for signed-in pages) and 2 (refocus refetch) stay open until the staging CPU check. The local migration (steps 1–3 of the D65 plan) has started; every cloud step needs the user's approval.

### Pending Character aggregate-checksum proposal — Codex, 2026-09-30

**Status: proposed; not approved or applied.** A note edit currently reads the complete Character
structure to update the independently persisted aggregate head hashes. Codex proposed keeping
validated typed records, identity/ownership/order/count checks and canonical full-capture hashes,
while deriving those aggregate hashes at assembly rather than persisting them on the head. This
would allow the note transaction to read only its notes/groups, collection counts, clocks and receipt.

That protection is different: assembly would no longer compare the complete structure with a
previously stored independent aggregate hash. Automatic approval review rejected the source patch
because that integrity-boundary change lacked explicit approval. The partial patch was restored;
current head checksums and assembly comparisons remain. The narrow note writer is frozen pending
the user's answer. Preserving current aggregate checks is the alternative, with complete structural
reads retained. [Exact local proposal](../../local-validation/character-head-checksum-proposal.md).

**Answer:** pending. This entry grants no migration or deployment permission.
