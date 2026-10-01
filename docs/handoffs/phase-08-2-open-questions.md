# Phase 8.2 open questions

> Questions waiting for the user's answer only; keep this file short. Answer inline under **Answer** (or in chat). Answered items move to [Resolved](phase-08-2-decisions.md#resolved) with the decision; decisions made on the user's behalf, approved implementation decisions and resolved questions live in [phase-08-2-decisions.md](phase-08-2-decisions.md).
>
> Updated: 2026-10-01.

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
