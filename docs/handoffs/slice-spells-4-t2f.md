# Slice SPELLS-4.T2f: ending effects and conditions by type, level or check

Status: **ruled (D174, 2026-10-22)**; the design below is approved as amended by "Rulings" at the end. Where they differ, the rulings win.
Class (D156): new generic option, class B. Unblocks SPELLS-31.T4f and SPELLS-33.T6b1.

## Brief

Convert `DISPEL_MAGIC`, `LESSER_RESTORATION`, `GREATER_RESTORATION`, `REMOVE_CURSE` and `PROTECTION_FROM_POISON` from `CLOSED_RULE` kinds to one generic authored option, delete the five kinds, and prove each with an authoring-parity test (SRD effects and a homebrew variant pass the node map and resolve alike, ADR 0038). No per-spell branch, no new plan shape (ADR 0039). This may close the D172 deferral "a cure does not end a condition early".

## Proposed design

### 1. Option: `END_EFFECTS` outcome (new `EFFECT_KIND`)

```
{ effectKind: 'END_EFFECTS',
  selectors: Selector[1..4],            // OR'd; an effect matches if any selector matches
  scope: 'ALL' | 'ONE_CHOSEN',          // ONE_CHOSEN: the caster picks one matching effect
  levelCheck?: { ability: 'SPELLCASTING', baseDc: 10, autoUpTo: 'SLOT_LEVEL' } }
```

Selectors (a discriminated union, all generic):

| Selector                       | Matches a held effect when                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONDITION { conditionIds[] }` | its `CONDITION_OWNERSHIP` state contribution names one of the ids (Lesser Restoration blinded/deafened/paralyzed/poisoned, Protection from Poison poisoned, Greater Restoration charmed/petrified) |
| `TAG { tags[] }`               | its definition `tags` include one (`CURSE`, `DISEASE`, `CHARM` ...)                                                                                                                                |
| `SPELL_LEVEL { max }`          | its definition `originLevel` (slot level it was created at) is at most `max`; `max` may be `SLOT_LEVEL` (Dispel Magic's higher-level auto-end)                                                     |

New stored definition data (required-nullable/sorted-unique, stored plans migrate in the same change, dev data reseeded, as D172 did): `tags: string[]` (authored on the result block `lifecycle.tags`) and `originLevel: number | null`. Tags are authored vocabulary, never spell names. Bestow Curse and the Drow/other disease riders gain `tags` in the same slice only where a converted spell needs the match.

### 2. Reuse of the early-end seam (no new seam)

- A selected set feeds `withLinkedDependents` (D172) so dependents end together, then `endedEffectReleases` releases conditions only those effects owned, and the existing `deleteCas` `ENDED` path removes them in the same transaction and receipt. Undo and replay already restore them together.
- One new pure function `selectedEndedEffects({ held, selectors, scope, chosen })` sits beside `actionEndedEffects` in `encounterEndedEffectRelease.ts` and returns `{ consumedGrants, sourceReleases }` in the shape its siblings return. The mechanics batch (`planEncounterMechanicsBatch`) applies it like any other outcome. No new event, no new event-table entry, no new call site: this is an outcome, not a trigger.
- A condition held with **no** owning effect (GM-set) is removed by a plain `CONDITION_REMOVE` through the same batch. This closes the D172 "cure does not end a condition early" deferral for authored cures.

### 3. Dispel Magic check

- Each matching effect above the automatic threshold (`autoUpTo: SLOT_LEVEL`, so level 3 or lower, or the slot level when higher) needs a spellcasting-ability check against DC `baseDc + originLevel`.
- Routed through the RULES-2.T6e3b generic worker check flow (D173): the check TEST phase with the actor's spellcasting modifier, DC kind `EFFECT_LEVEL` (the DC is derived per candidate effect, a new generic check DC kind next to `PASSIVE` and `CONCEALMENT`), success band applies `END_EFFECTS` to that one effect. Candidates roll in order inside the action's one roll window and settle through the single d20 settlement function; no new settlement code, no per-spell rule.
- Natural 20/1 follow the check flow's existing rules (no special case).

### 4. Choosing one effect (`ONE_CHOSEN`)

Lesser Restoration ("one disease or one condition"), Greater Restoration, Protection from Poison ("one poison") need the caster to pick one matching effect. Proposal: a pause kind `END_EFFECT_CHOICE` on the single pending-choice pause (ADR 0039 decision 3) using the shared sealed-choice lifecycle; the server derives the legal list. The existing `effectOffers` menu in the web actor drawer/stage shows it. Auto-chosen when exactly one matches, skipped when none (shared overridable warning at admission, per D173 Q1, declared as outcome data).

### 5. Conversions

| Kind                   | Authored as                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DISPEL_MAGIC           | `END_EFFECTS { selectors: [SPELL_LEVEL max SLOT_LEVEL...], levelCheck }` on a creature/object target                                                                                                                      |
| REMOVE_CURSE           | `END_EFFECTS { selectors: [TAG CURSE], scope: ALL }`                                                                                                                                                                      |
| LESSER_RESTORATION     | `END_EFFECTS { selectors: [TAG DISEASE, CONDITION blinded/deafened/paralyzed/poisoned], scope: ONE_CHOSEN }`                                                                                                              |
| GREATER_RESTORATION    | `END_EFFECTS { selectors: [CONDITION charmed/petrified, TAG CURSE], scope: ONE_CHOSEN }`; see open questions for the exhaustion, ability and hit-point-maximum clauses                                                    |
| PROTECTION_FROM_POISON | `END_EFFECTS { CONDITION poisoned, ONE_CHOSEN }` plus the existing `APPLY_GRANT` for save advantage and poison resistance (verify both exist as authored grants; otherwise they are a gap to report, not to special-case) |

## Acceptance criteria (proposed, for confirmation)

1. An authored `END_EFFECTS` outcome ends held effects matched by condition id, tag or origin level, releasing only conditions those effects alone held, with linked dependents, in one transaction and receipt; undo restores them.
2. `ONE_CHOSEN` pauses for the caster's pick from the server-derived list, auto-picks a single candidate and warns when none.
3. A level-checked end rolls the spellcasting check against `10 + originLevel` per candidate above the automatic threshold through the generic check flow, and only a success ends that effect.
4. The five kinds are deleted from `closedRuleKind.ts`; their SRD spells compile from core options; each has an authoring-parity proof (SRD plus a homebrew variant through the effect node map, `compile` via the real compiler).
5. Room journey: a Dispel Magic cast ends a held spell effect (below-threshold automatic, above by check) on the target in the Session Worker room.
6. Docs: `rules-runtime.md`, ADR 0038 consequences, decisions entry.

## Tests (red first)

- `packages/rules-runtime/src/__tests__/selectedEndedEffects.test.ts`: selectors, linked dependents, release of sole-owned conditions, bare condition removal.
- `packages/authoring/src/nodeRuntime/endEffectsAuthoringParity.test.ts`: SRD effects and a homebrew variant (another tag set / DC base) pass the node map unchanged.
- `packages/rules-runtime/src/__tests__/endEffectsCompilation.test.ts`: each SRD spell compiles from the catalogue through the same options.
- `apps/session-worker/test/nativeRoomEndEffects.test.ts`: Dispel Magic room journey, plus Lesser Restoration choice pause.

## Golden flips (expected)

Graph checksums of exactly these SRD authored effects change (`CLOSED_RULE` becomes `END_EFFECTS`): Dispel Magic, Lesser Restoration, Greater Restoration, Remove Curse, Protection from Poison (one effect each; PFP also gains its grant outcome if not already present). Any SRD creature/feature that embeds those spell effects by reference stays unchanged (to be confirmed by running the golden harness). Effects gaining `tags` or `originLevel` in stored definitions change plan shape only (no graph checksum), enumerated when measured.

## Open questions for the ruling

1. **Multiple checks per cast (Dispel Magic):** ordered per-candidate rolls in one roll window (proposed) versus requiring the caster to pick one effect per cast (simpler; deviates from "each spell above...").
2. **Greater Restoration's other clauses** (exhaustion reduction, ability-score reduction, hit-point-maximum reduction, attunement break): which have authored state today? Proposal: `CONDITION`/`TAG` clauses now; hit-point-maximum and scalar reductions via an additional selector `REDUCTION { kinds }` if their records are effect-owned; exhaustion level reduction and attunement only if an existing option exists, else description-only per D156 and registered to the roadmap. Rule on scope.
3. **Targets that are placed zones or objects** ("magical effect within range"): out of scope here (creature/object target only), zone-targeted dispel registered as a follow-up. Agree?
4. **New pause kind** `END_EFFECT_CHOICE` versus reusing the effect-offer menu only.
5. **New check DC kind** `EFFECT_LEVEL` (per-candidate DC) on the T6e3b check flow: confirm it is wanted there rather than a per-spell DC.

## Rulings (D174, 2026-10-22, orchestrator)

1. **Dispel checks:** one ordered check per candidate, settled through the single d20 settlement and the T6e3b check flow. The caster does not pick one effect per cast. If the check flow can hold only one check per action, stop and report before widening it.
2. **Greater Restoration:** cover the CONDITION and TAG clauses now. No REDUCTION selector: ability-score and hit-point-maximum reductions that are held effects get authored tags and a TAG selector ends them. Exhaustion reduces through an existing condition-level option if one exists; if not, report so a follow-up is registered. Attunement stays description-only (deferred edge case).
3. **Dispel on zones and objects:** out of this slice, registered as ledger task SPELLS-4.T2f2 (not a future-enhancement item).
4. **No new pause kind.** `ONE_CHOSEN` is a cast-time pick of one of the target's matching effects. It rides on the cast command like a target pick: the server derives and validates the legal list, picks automatically when one matches, and gives the D173 overridable warning when none does. If the command path cannot carry the pick, report back. (This replaces section 4 above and removes `END_EFFECT_CHOICE`.)
5. **DC kind** is `TARGET_EFFECT_LEVEL`: authored base plus the candidate's `originLevel`. An effect with no `originLevel` does not match `SPELL_LEVEL`.
6. **Tags** are System vocabulary codes validated at ingress as T9b validates `rollInfluence` codes; never free strings or spell names. Build on T9b after it merges (merge the phase tip then). Stored plans migrate in the same change; the orchestrator runs the local reset after merge.
7. ACs accepted, AC 2 reworded to "cast-time pick".

### D174 decisions-entry draft (for the orchestrator to copy at merge)

- **D174** (2026-10-22) Ending effects and conditions by type, level or check (SPELLS-4.T2f, AC 4.1; [slice-spells-4-t2f.md](slice-spells-4-t2f.md)). Orchestrator ruling under D156.
  - **Option:** a generic `END_EFFECTS` outcome with selectors `CONDITION {conditionIds}`, `TAG {tags}` and `SPELL_LEVEL {max}` (an effect with no `originLevel` never matches), scope `ALL` or `ONE_CHOSEN`, and an optional per-candidate level check. It ends held effects through the D172 `withLinkedDependents`, `endedEffectReleases` and `deleteCas` `ENDED` seam in one transaction and receipt, so it closes D172's "a cure does not end a condition early" deferral for authored cures. Stored definitions gain `tags` (System vocabulary codes) and `originLevel`.
  - **Dispel Magic:** one ordered check per candidate above the automatic threshold, against `TARGET_EFFECT_LEVEL` (authored base plus the candidate's `originLevel`), through the single d20 settlement and the T6e3b check flow.
  - **ONE_CHOSEN:** a cast-time pick carried on the cast command like a target pick, with a server-derived legal list, an automatic pick for a single match and the D173 overridable warning for none. No new pause kind.
  - **Greater Restoration:** CONDITION and TAG clauses now; reductions that are held effects take tags; exhaustion reduces through an existing condition-level option or becomes a follow-up; attunement stays description-only.
  - **Out of scope:** dispel on zones and objects (SPELLS-4.T2f2).
  - **Rejected:** one effect per Dispel cast; a REDUCTION selector; a new END_EFFECT_CHOICE pause kind; free-string tags.

## Scope change (option B, 2026-10-22, orchestrator)

The T6e3b check flow holds one check per action and only for a basic action or a Creature feature with a fixed DC (`checkActionSource`), so Dispel Magic cannot run on it as ruled.

- **T2f keeps** Lesser Restoration, Greater Restoration, Remove Curse and Protection from Poison: `END_EFFECTS` with `CONDITION` and `TAG` selectors and the cast-time pick. No roll. The room journey is Lesser Restoration's pick. Add `TAG` once T9b merges (merge the phase tip then).
- **SPELLS-4.T2f1** takes all of Dispel Magic: `SPELL_LEVEL`, `originLevel`, `levelCheck`, `TARGET_EFFECT_LEVEL`, and widening the check flow to spell sources and ordered per-candidate checks. It waits on RULES-2.T6e3b2. `DISPEL_MAGIC` stays a closed rule kind until then.
- **SPELLS-4.T2f2** (dispel on zones and objects) follows T2f1.
- Sections above that name Dispel Magic, `SPELL_LEVEL`, `originLevel`, `levelCheck` or `TARGET_EFFECT_LEVEL` describe T2f1, not this slice. AC 3 and the Dispel room journey and golden flip move to T2f1; the T2f golden flips are the four remaining spells.
- D174 draft: the entry stands, with Dispel Magic's check, `SPELL_LEVEL`/`originLevel` and the check-flow widening attributed to SPELLS-4.T2f1 (it waits on RULES-2.T6e3b2), and `DISPEL_MAGIC` kept as a kind until then.
