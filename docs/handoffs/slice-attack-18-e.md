# Slice workbook: ATTACK-18 slice E (basic actions offered by facet restrictions; FREE_HAND)

**Status:** OPEN (started 2026-10-13)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Finish ATTACK-18. A `BASIC_ACTION` document's `restrictions` (carried since slice A, not evaluated) become live: a basic action is offered only to actors that meet its authored facet restrictions, an unmet restriction is refused with `SOURCE_REQUIREMENTS_NOT_MET` through the existing `sourceStateRequirements` check, and a basic action with no restriction is offered to every actor. `FREE_HAND` becomes an authorable predicate, true while either hand is empty; it reads `resolveHandOccupancy` (`packages/shared/src/domains/subjects/core/equipmentHands.ts`, AUTHORING-17). Characters and Creatures both.

Then close ATTACK-18.1: confirm no closed basic-action mechanic code or old path remains (slice D already deleted `USE_BASIC_ACTION`, the catalogue `check` and `mechanics`, `STABILIZE_TARGET`, `BASIC_ACTION_MECHANIC_CODE`); delete anything left. The catalogue stays locked in the SRD and copyable into a homebrew System. Grapple and Shove are ATTACK-7 (slices C and F) and are out of scope here. Add one end-to-end journey that uses an authored basic action, and update `docs/architecture/rules-runtime.md` and the D106 ATTACK-18 addendum in `phase-08-2-decisions.md` ("Slice E built").

Read first: D106 and its ATTACK-18 addendum (slices A–D built notes), D107 (hands) in `docs/handoffs/phase-08-2-decisions.md`; [slice-attack-18-d.md](slice-attack-18-d.md); `docs/architecture/rules-runtime.md`.

## Closes

- Task ATTACK-18.T6; ACs ATTACK-18.1 and ATTACK-18.3. ATTACK-18.2 (behavior unchanged) closes with them if every existing proof stays green.

## File scope

`packages/schema`, `packages/shared` (facets, targeting, hands), `packages/rules-runtime` basic-action offering and restriction evaluation, `packages/source-data` basic actions, `apps/apis/convex/encounters` action choices, the Session Worker's basic-action routing, and their tests. Out of scope: the web action drawer (`apps/web/src/domains/campaigns/vtt/**`), owned by the parallel VTT session. Offering is decided by the server's choice list, so the drawer should need no change; if it does, report it instead of editing.

## Red-first checklist

1. An authored basic action restricted by `FREE_HAND` is not offered to an actor with both hands full and is offered once a hand is free (Character and Creature).
2. Resolving that action with both hands full is refused `SOURCE_REQUIREMENTS_NOT_MET` (room and Convex).
3. A basic action with no restriction is offered to every actor, including one with both hands full.
4. A restriction on another facet (not FREE_HAND) is evaluated by the same check, proving restrictions are generic, not FREE_HAND-only.
5. A homebrew System copy of the SRD catalogue keeps the restrictions and they apply.
6. Journey: an authored basic action offered, resolved, logged with its label and undone in a real room or convex-test Run.
7. A repo search proves no closed basic-action code remains (list the search in the status log).

## Status log

- 2026-10-13: workbook written; session started.

## Proposed ledger edits (filled by the slice session)
