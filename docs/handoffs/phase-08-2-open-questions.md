# Phase 8.2 open questions

> Questions waiting for the user's answer only; keep this file short. Answer inline under **Answer** (or in chat). Answered items move to [Resolved](phase-08-2-decisions.md#resolved) with the decision; decisions made on the user's behalf, approved implementation decisions and resolved questions live in [phase-08-2-decisions.md](phase-08-2-decisions.md).
>
> Updated: 2026-10-06.

## Open

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

### Departure: GM play history versus GM modifiers (D81) — Claude, 2026-10-02

Confirm the split in [D81](phase-08-2-decisions.md): when a Character leaves a Campaign, GM play
history (damage taken, items given, XP) is kept, and GM modifiers (maximum HP and stat adjustments,
Run-applied effects, Campaign settings) end at departure.

**Answer:** pending.

### Departure: spell-source customizations (D81) — Claude, 2026-10-02

`UPDATE_SPELL_SOURCE_CUSTOMIZATION` (customName, displayAsAttack in `sheetState.spellCustomizations`)
currently survives departure. Players can also write these, so GM-written ones cannot be told apart.
Recommendation: keep them, as player-facing presentation.

**Answer:** pending.

### Better Auth rate limits for session reads — Claude, 2026-10-06

Should the Better Auth rate limits for session reads (`/convex/token`, `/get-session`) be raised?
Under proof load, sign-in hit 429s. The web client now retries `GET /convex/token` on network error,
429 and 5xx (up to 4 attempts, backoff up to 15 s, honouring `Retry-After`; see
[transport.md](../architecture/transport.md)). Recommendation: keep the limits and revisit with real
usage data.

**Answer:** pending.
