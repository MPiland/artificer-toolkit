# Phase 8.2 open questions

> Questions waiting for the user's answer only; keep this file short. Answer inline under **Answer** (or in chat). Answered items move to [Resolved](phase-08-2-decisions.md#resolved) with the decision; decisions made on the user's behalf, approved implementation decisions and resolved questions live in [phase-08-2-decisions.md](phase-08-2-decisions.md).
>
> Updated: 2026-10-13.

## Open

### OQ-1 Authoring form context store (RELIABILITY-9.5)

**Context.** `AuthoringFormContext` (884-line provider, about 70 fields, 26 consumers) holds state that `FormRenderer.tsx:441-459` copies up from the form through effects, and `AuthoringLayoutProvider` stacks a 17-field context on top. AGENTS.md forbids context as a general store and controller objects passed through trees. Fixing it touches every authored domain form.

**Options.**
1. Split by behaviour: the TanStack form is the only value store; small contexts for navigation/cancel, layout and the page actions, each read where needed; delete the effect mirroring.
2. Keep one context but remove the child-to-parent mirroring only.
3. Defer until after the authoring PBIs land.

**Recommendation.** Option 1, as its own PBI after RELIABILITY-8.1's typed form factory, which removes most of the per-domain plumbing first.

**Answer.**

### OQ-2 Feature-named rule kinds and spell-named effect kinds

**Context.** About 725 closed rule kinds are named after one feature, and some effect kinds after one spell (PLANT_PORTAL, TREE_STRIDE, TELEPATHIC_LINK), which ADR 0023's "codes are not dispatch keys" argues against.

**Options.**
1. Replace each with general mechanics as its feature gets automated.
2. Redesign the rule vocabulary in one pass now.

**Recommendation.** Option 1: no big-bang redesign; each automation PBI replaces the named kinds it touches.

**Answer.**
