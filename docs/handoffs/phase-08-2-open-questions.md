# Phase 8.2 open questions

> Questions waiting for the user's answer only; keep this file short. Answer inline under **Answer** (or in chat). Answered items move to [Resolved](phase-08-2-decisions.md#resolved) with the decision; decisions made on the user's behalf, approved implementation decisions and resolved questions live in [phase-08-2-decisions.md](phase-08-2-decisions.md).
>
> Updated: 2026-10-16 (Q23 opened).

## Open

### Q23. Remove the rules continuation seal (RULES_CONTINUATION_SECRET)?

**Context.** An audit on 2026-10-16 found that the HMAC seal on paused rule continuations no longer protects a real boundary:

- No client ever receives a continuation or sends one back. Clients answer with `RESOLVE_RULE_OCCURRENCE`, which carries ids, a version and dice or a choice.
- Convex never seals or verifies; only the Worker does (`nativeLiveSessionRoom.ts:3876`).
- The original reason was cross-service resume. It ended when the room became the only Encounter writer (`276ad42d1`, `e3f51905a`, ADR 0035).
- The seal covers only part of the snapshot. `applicationContext`, `AGGREGATE_CHOICE` snapshots, actors and definitions are unkeyed anyway.
- Replay, version and encounter binding are enforced elsewhere.
- What the seal still does: resume skips graph validation, so the seal is the only proof that a resumed graph came from the compiler.
- The "user ruling 2026-09-24" for a dedicated key is unconfirmed; the user does not recall it.

**Options.**

1. Remove it. Add `executeFrozen`'s graph validation to `resume`/`resumeWithGraph`, make `seal` optional, then delete it, cancelling paused decisions (the ADR 0033 precedent). Delete the key, fixtures and env names, update the docs, and add an ADR 0029 amendment. This is one platform PBI of about size 3.
2. Keep it as defense against Convex-side tampering, and fix the docs that say Convex needs the key.

**Recommendation.** Option 1: less code, one fewer secret to rotate, and validation that does not depend on a key.

**Answer.**
