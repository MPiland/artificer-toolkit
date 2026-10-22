# RULES-2.T6e: compiler refusal classification and outcome

Status: current. The work is on branch `rules-2-t6e`, from base `69e168205`. Line numbers in the inventory refer to
`packages/rules-runtime/src/systems/dnd5e/effectActionCompiler.ts` at the base.

## Ruling (orchestrator)

T6e covers the dispatch table, G1 and G2. The other gaps were split into their own tasks:

| Gap    | Follow-up       |
| ------ | --------------- |
| G6     | SPELLS-33.T4i1e |
| G3, G7 | RULES-2.T6e2    |
| G4, G5 | RULES-2.T6e3    |

The room is not changed in T6e. The golden is unchanged apart from the G1 and G2 flips.

## Method

A throwaway inventory test compiled every SRD effect the same way `srdEffectCompileGolden` does: Creature discovery
then `compileEncounterFeatureActionPlan`, or Character then `compileExecutionPlan`. For each refusal it recorded the
site from the stack trace. It found 628 refusals, one per REFUSED line in the golden, spread over 185 `unsupported(`
call sites.

Each refusal is in one of four classes:

- **V**: input validation. Kept.
- **R**: a genuine rule. Kept.
- **P**: a missing primitive. It needs new runtime, so it gets its own PBI.
- **G**: an implementation gap that existing pieces can compose.

## SRD refusals by site

| Count | Site                            | Representative effects                                                                                    | Class                                |
| ----- | ------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 346   | `supported` shape check (4024)  | Passive traits, AREA_CONTENTS without a pool, special or missing targeting, unsupported reaction triggers | Mostly V and P (areas are T6f zones) |
| 109   | `supportedTestPhaseKind` (4417) | Passive attack riders, free legendary saves, area saves, self saves                                       | P and R, plus **G1**                 |
| 67    | `supported` entry check (4052)  | Timed manual adjudication, two plans on use, FOLLOW_UP_CHECK, False Life, a sequence of one grant (Haste) | P, plus **G2**                       |
| 43    | `supported` (4173)              | CLOSED_RULE or MANIFEST on use                                                                            | P (MANIFEST is T6f)                  |
| 39    | `boundedOutcome` (1174)         | CLOSED_RULE riders, a follow-up inside an ON_HIT sequence, a dice heal on a failed save                   | P                                    |
| 20    | 4453                            | See below                                                                                                 | Mixed                                |
| 4     | 4435                            | Follow-up save shapes the template does not match (Blindness/Deafness, Flesh to Stone)                    | P                                    |
| 3     | 4195                            | A fixed heal that scales (Wholeness of Body), Aid, Mass Heal                                              | P                                    |
| 1     | list gate (4087)                | Astral Projection (manual adjudication on a list)                                                         | P; the list gate itself is **G3**    |

The 20 refusals at site 4453:

- Vampire Unarmed Strike and Claws: an ON_HIT choice between damage and a grapple. This is **G6**.
- Bestow Curse: a choice of grants on a failed save. This needs a cast choice under a test path, so it is P.
- Charm, Fey Charm and Dominate ×3: a timed condition on a save with no printed end. This is **R**:
  `ownsTimedSaveCondition` refuses on purpose because the data has no repeat save.
- Suggestion, Modify Memory: a timed manual adjudication under a save. P.
- Entangle, Grease, Incendiary Cloud, Insect Plague: MANIFEST on use plus a save. P, T6f zones.

## Gaps

| Id  | Refusal                                                                                             | Outcome                                            |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| G1  | The test activation check refused `FREE` outright, but the shape check accepts `FREE` with a charge | Done in T6e                                        |
| G2  | A direct entry authored as a sequence of one outcome was refused, but a single result passes        | Done in T6e                                        |
| G3  | The list gate refuses condition, kill, target-only, teleport allowance, conceal and cancel outcomes | RULES-2.T6e2 (needs an executor proof)             |
| G4  | A contest refuses outcomes other than a relationship, a condition or forced movement                | RULES-2.T6e3                                       |
| G5  | A non-contest check refuses registry outcomes                                                       | RULES-2.T6e3                                       |
| G6  | Legendary discovery drops choice options instead of planning them as a cast choice                  | SPELLS-33.T4i1e (fix is in discovery and the room) |
| G7  | A hit-point gate under a test path is refused                                                       | RULES-2.T6e2                                       |

### G1: a charged free activation

`isChargedFreeActivation` in `effectActionTargetPolicy.ts` is now the one predicate for the rule that a Legendary
Action option is free and its Feature charge is its cost. Three checks share it: the direct shape check, the test
activation check and the single-target range policy. The test activation check alone was not enough: the range policy
also refused a free activation.

- Proof: `encounterLegendaryAction.test.ts`, "offers and runs a free save option that spends the pool, as the SRD
  authors Wing Attack". It keeps the SRD option's free activation, cost 2 and DC 25 Dexterity save, and narrows only
  its targeting to one creature within 15 ft. Area saves are T6f. The test checks four things: the option is offered,
  it costs 2 and leaves 1, the save pauses at DC 25, and the failed save spends the charge and applies the damage.
- Golden: no change. Creature discovery gives these options no `resourceUse`, so only legendary discovery reaches the
  new admission.

### G2: a sequence of one outcome

The direct entry check now refuses only a `CHOICE` group. A `SEQUENTIAL` group of one entry compiles as `SINGLE`.

- Proof: `characterSpellCastActions.test.ts`, "compiles Haste to its minute of grants, extra action and lethargy under
  Concentration, as a single result would". It checks the 10-round plan, the speed, AC and Dexterity save modifiers,
  the granted extra action, the one-turn lethargy on end, and the Concentration maintenance.
- Golden: one flip. `00000020-0000-0210-009f-000000000001 CHARACTER:spells Haste` changes from REFUSED ("must have
  one fixed direct result without lifecycle overrides") to `SINGLE_GRAPH … nodes=1 outputs=1`.
- Not changed: the two recurring-plan sites still require `SINGLE`. A trial that relaxed them flipped no golden line,
  and no SRD record proves them, so they were reverted.

The sweep allowlist (`srdCreatureAttackSweepAllowlist.ts`) is unchanged, with 27 entries.

## Dispatch table

`DND5E_DIRECT_OUTCOMES` replaces the ladder in `supported()` that switched on the authored outcome kind. It has one
entry per kind and no wrapper layer. These went with it:

- The three refusals in `compileEffectActionGraph` that could not be reached: dice scalar reduction, forced movement
  and hit-point-maximum reduction without a test.
- The `expectedOperation` ladder in `dnd5eActiveEffectPlans`. It now reads the outcome registry's `operationKey`.

The 15 copies of the published-graph construction became one helper, `publishedGraph`. The compiler's size budget
dropped from 6890 to 6852 code lines.

## Kept as genuine rules (R)

- Conceal or detect outside a check.
- `DND5E_CANCEL_NEEDS_SPELL_CAST_REACTION`.
- A passive DC pairs only with conceal, and a concealment DC pairs only with detect.
- A check action lists exactly one check.
- A Concentration spell must have a maintained effect.
- An active-effect plan needs a carrier.
- `ownsTimedSaveCondition`.
- A self teleport under a test.
- `KILL` under a test only with hit-point tiers.
- A hit-point pool area's outcome is a timed condition.
- At most one relationship outcome per action.
- `MAX_CONDITIONS_PER_PATH`.

## Missing primitives (P)

These are out of T6e and need their own PBIs:

- CLOSED_RULE.
- A timed manual adjudication.
- More than one plan per action (Empty Body, Gaze of Two Minds).
- FOLLOW_UP_CHECK.
- A fixed heal that scales.
- A pool area heal (Mass Heal).
- Dice temporary hit points with a duration (False Life).
- Area saves without zones, and MANIFEST (T6f).
- A cast choice under a test path (Bestow Curse).

## Input validation (V)

These are kept: identity and UUID checks, malformed bounds, vocabulary checks, the normalized charge identity and
positive cost check, and the refusal of a non-action that has no test phase.
