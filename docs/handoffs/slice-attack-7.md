# Slice ATTACK-7: Grapple and shove

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- This session: T3 (the basic Grapple and the contested escape; AC 7.1 and 7.3), then T4 (release with no action and the end sweeps; AC 7.4).
- T5, T6, T7 and T9 are follow-up sessions. T8 waits for ATTACK-11.
- Contracts: [D152](phase-08-2-decisions.md) (rulings on the seven changes). Built from core options (ADR 0038), with failing-first tests on real code and a room journey per AC.
- Out of scope (D152): a release-on-draw prompt. Drawing with every hand full is refused by the existing hand check.

Base: `origin/codex/phase-08-2-convex-cutover` (`74486c6cf`). CI branch `ci/attack-7`.

## Tasks

| Task | Title                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Closes      | Depends on |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| T3m  | Migrate Disarm and the movement-passage contests (Overrun, Tumble, Shove Aside) onto the one `ENCOUNTER_CONTEST_CHECK` context, with a discriminated `origin` (BASIC_ACTION, ESCAPE, OPTIONAL_COMBAT; named `origin` because the context's `source` field already holds the action's provenance), and delete `ENCOUNTER_OPTIONAL_COMBAT_CONTEST`. The OPTIONAL_COMBAT origin carries the pin, option, selection and movement continuation; BASIC_ACTION and ESCAPE land with the grapple in T3. Its own commit, pushed to `ci/attack-7` for a green run before the grapple contest uses it. Only renames in the passage tests; any other assertion change is reported first. | none        | none       |
| T3   | The basic Grapple (contest, Grappled on a win, held at once 2, Character or hand-bearing Creature with a free hand, one Attack-action slot, within reach and at most one size larger, free weapon stow, a hold occupies a hand) and the contested escape                                                                                                                                                                                                                                                                                                                                                                                                                     | AC 7.1, 7.3 | T3m        |
| T4   | Free release by the source, and the after-commit sweep that ends a grapple when the grappler can't act or the held creature leaves the sealed reach                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | AC 7.4      | T3         |
| T4b  | Release on any turn: a per-member read of the holds a member's actors source, and a tabletop Release control that issues `RELEASE_RELATIONSHIP` on another creature's turn, with a room journey and a browser test                                                                                                                                                                                                                                                                                                                                                                                                                                                           | AC 7.4      | T4         |

T3 merges only once Disarm and passage are on the new context; the two contexts never land side by side.

## Findings from reading the code (2026-10-17)

- The CHECK action compiles only a FIXED, PASSIVE or CONCEALMENT dc with a STABILIZE, conceal or detect outcome (`effectActionCompiler.ts` `supported`). Relationship outcomes need an attack hit (`relationshipPlan`, and `reachesAuthoredPath` in `encounterActionEffectPlans.ts`).
- The two-roller contest engine is generic (`executeEncounterOptionalContestAction`, `createDnd5eOptionalCombatContestGraph`). Its pending context is bound to optional combat (an actionKind enum and a required pin); that context is what T3m replaces.
- An escape is offered only for a FIXED dc (`findEncounterHolderEscape`).
- Facet contexts don't gate their subject on the holder's kind, and CREATURE_TYPE fails closed in an Encounter.
- `resolveHandOccupancy` counts items only. The only stow is the two-handed-grip shield stow.
- Only MELEE, RANGED and UNARMED attacks fill an Attack-action slot.
- No sealed reach, release command or relationship end sweep exists. The only end is `endEncounterRelationshipEffect`.
- Three private size-rank tables exist; T3 replaces them with one shared `sizeRank`.

## Progress

- 2026-10-17: synced; T3m size reported (30 files, 83 references) and approved. Started the shared `sizeRank` with a failing-first test.
- 2026-10-17/18: T3m landed (one `ENCOUNTER_CONTEST_CHECK` context). T3 pieces landed: the shared size rank, the size limit, the ATTACK basic-action cost, held creatures filling hands, the free weapon stow, and the SRD Grapple compiling to the contest graph (a contest win holds the target). T4 landed: the sealed reach, the free `RELEASE_RELATIONSHIP` by the source, and the after-commit `RELATIONSHIPS_ENDED` sweep (source can't act, or the held creature beyond the sealed reach), with room journeys.
- 2026-10-18: rulings 1 and 2 arrived (recorded as D152 amendments). T4 landed: the current actor's `releases` choices and the tabletop Holding section. Next: T3b (the room Grapple contest with `CONTEST_CHECK`), T3c (the contested escape), T3d (the web contest prompt), then T4b (Release on any turn).
