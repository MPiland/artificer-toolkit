# Slice SPELLS-4.T2j: attacker and source qualifiers on grants

Status: **T2j1 implemented (D179)**; T2j2 (Holy Aura rider, Dispel Evil and Good) is a later card.

## Ruling D179 and what T2j1 built

Option A, split. T2j1 covers the qualifier, qualified effect defenses, Protection from Evil and Good (the spell and Purity of Spirit), Stoneskin and Wind Walk; the `PROTECTION_FROM_EVIL_AND_GOOD`, `STONESKIN` and `WIND_WALK` closed rule kinds are deleted. Wind Walk's "nonmagical weapons" is bludgeoning, piercing and slashing resistance from attacks without the `MAGICAL` trait; Possession, the flying speed and Dismissal stay description-only.

- **Qualifier:** a `SOURCE_CREATURE_TYPE` facet predicate (selectable `creatureTypeIds`, subject `CREATURE`, INCLUDE or EXCLUDE) names the source creature's type. The source is the attacker for `ATTACKS_AGAINST`, the effect's origin for condition immunity. The fold keeps it as a deferred requirement (`DEFERRED_CONDITION_KINDS`); `holderStateSourceQualifier` splits a grant's holder conditions (checked when the holder is prepared) from its source conditions, which travel with the grant (`sourceQualifier`) and are decided by `sourceQualifierAdmits` where the source is known (`prepareEncounterActionMechanics`).
- **Qualified effect defenses:** `DAMAGE_RESISTANCE` and `DAMAGE_IMMUNITY` payloads take an optional `bypassedBy`. Characters fold them into `qualifiedDefenses` on the policy output; Creature holders merge them in `withCreatureActiveGrantProtection`. Both feed the one `dnd5eAttackDamageDefenses` evaluator.
- **Condition immunity by source:** `encounterSourceConditionImmunities` collects them per holder (`MovementTarget.sourceConditionImmunities`); `conditionImmunityIdsAgainstSource` adds those admitting the acting source at action preparation.
- **Shared builders:** `protectionFromEvilAndGoodGrants` (spell and Purity of Spirit), `nonmagicalWeaponResistanceGrants` (Stoneskin, Wind Walk), `sourceCreatureTypeRestriction`.

### Deviations from D179

- A separate `SOURCE_CREATURE_TYPE` predicate instead of a `subject` on `CREATURE_TYPE` (no stored-plan change for existing `CREATURE_TYPE` restrictions).
- `attackDomains` omitted (redundant with the per-domain `ATTACKS_AGAINST` grants); `SOURCE_TRAIT` is not built and waits for T2j2.
- Source-qualified condition immunity applies at action preparation only. Turn and spatial effects (`encounterTurnEffects`, `encounterSpatialCandidateExecution`) bind the holder's unqualified immunities, because their origin actor's type is not on those paths.
- The Protection from Evil and Good clause "advantage on a new saving throw against an existing charm or fright from such a creature" stays description-only: it needs an effect-imposes-condition qualifier beside the source type.

Class (D156): new generic option, class B. Unblocks SPELLS-31.T4j/T4r/T5k, SPELLS-32.T4j (Fey Ancestry, Gnome Cunning, Dwarven Resilience) and SPELLS-33.T4j.

## Brief

Convert `PROTECTION_FROM_EVIL_AND_GOOD`, `HOLY_AURA`, `DISPEL_EVIL_AND_GOOD`, `STONESKIN` and `WIND_WALK` from `CLOSED_RULE` kinds to authored options, delete the five kinds, and prove each with an authoring-parity test (SRD effect and a homebrew variant pass the node map and resolve alike, ADR 0038). No per-spell branch (D156), no new plan shape (ADR 0039). `PROTECTION_FROM_EVIL_AND_GOOD` is also used by the Oath of Devotion feature Purity of Spirit (`oath-of-devotion.ts`), which converts with it.

## What exists today

- **Grants:** `APPLY_GRANT` modifier grants. `ATTACKS_AGAINST` (ROLL_INFLUENCE / SUPPRESS_ROLL_INFLUENCE) gives attacks against the holder advantage or disadvantage, filtered by attack domain, sight and occasion in `encounterAttackAgainstContributors` and the `attacksAgainst` filter of `encounterActionMechanicsPreparation.ts`, which already holds the attacker (`actor`, `sourceFacts`). `SAVING_THROW_MODIFIER` takes `ability`, `conditionTypeId`, `ruleDefinitionId`, `requiresHolderSeesSource`. `CONDITION_IMMUNITY` folds into a bare `conditionImmunityIds` list (`encounterActiveGrants.ts`). `DAMAGE_RESISTANCE`/`DAMAGE_IMMUNITY` have an empty domain and fold into `defenses`.
- **Modifier restrictions** (`restrictions`, OR of AND groups, `INCLUDE`/`EXCLUDE`; D152) carry a `CREATURE_TYPE` predicate, but only about the **holder**. `holderStateRestrictionsHold` fails closed on any condition it cannot decide.
- **Qualified defenses** (`bypassedBy: MAGICAL | SILVERED | ADAMANTINE`, "from nonmagical attacks") exist only on a Creature stat block (`creatureQualifiedDamageDefenseDtoSchema`, `qualifiedDefenses` on target facts). An active-effect resistance cannot carry them.
- **Precedents for an attacker qualifier:** `incomingAttackGatePayload.attackerCreatureTypeIds` (Circle of the Land Nature's Ward) and `againstEffectSource` on attack-roll grants (Bestow Curse). Both are per-grant ad hoc fields.
- Creature type of any actor is already derivable: `snapshotCreatureTypeId(actor)`. Creature types are System vocabulary ids (ADR 0039 amendment), so a qualifier names ids, never a platform enum.
- `END_EFFECTS` (T2f/D174) with `CONDITION` and `TAG` selectors and a cast-time pick is merged. Retaliation on a melee hit is `MANIFEST` with `interactionKinds: ['MELEE_HIT_ON_SOURCE']` (Fire Shield).

## SRD clauses per spell

| Spell                         | Clause                                                                                                        | Resolved state        | Authored as (proposed)                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protection from Evil and Good | Aberrations, celestials, elementals, fey, fiends, undead have disadvantage on attack rolls against the target | attack roll           | `ATTACKS_AGAINST` disadvantage, **attacker** creature types                                                                                          |
|                               | Target can't be charmed, frightened or possessed by them                                                      | condition application | `CONDITION_IMMUNITY` charmed, frightened, **origin** creature types. "Possessed" has no System condition: description-only, registered               |
|                               | Already charmed/frightened/possessed by such a creature: advantage on new saves against the effect            | save                  | `SAVING_THROW_MODIFIER` advantage keyed by `conditionTypeId` charmed/frightened, **source** creature types                                           |
| Holy Aura                     | Creatures of your choice in 30 ft: advantage on all saves                                                     | save                  | `SAVING_THROW_MODIFIER` advantage, no ability, on a chosen-creatures area (existing targeting). No qualifier                                         |
|                               | Other creatures have disadvantage on attack rolls against them                                                | attack roll           | `ATTACKS_AGAINST` disadvantage, no qualifier                                                                                                         |
|                               | Fiend or undead hits with a melee attack: Con save or blinded until the spell ends                            | save, condition       | `MANIFEST` `MELEE_HIT_ON_SOURCE` with **attacker** creature types fiend/undead, Con save, condition blinded for the effect's duration                |
|                               | Shed dim light in 5 ft                                                                                        | light                 | description-only (no resolved state), registered                                                                                                     |
| Dispel Evil and Good          | Disadvantage on attacks against you from celestials, elementals, fey, fiends, undead                          | attack roll           | as Protection from Evil and Good                                                                                                                     |
|                               | Break Enchantment: end charm, fright, possession by those types                                               | condition             | granted action, `END_EFFECTS` `CONDITION` selector with **origin** creature types                                                                    |
|                               | Dismissal: melee spell attack, Cha save or sent to home plane                                                 | removal               | description-only, same as the `BANISHMENT` kind it would reuse (its own T2 task)                                                                     |
| Stoneskin                     | Resistance to nonmagical bludgeoning, piercing, slashing                                                      | damage                | `DAMAGE_RESISTANCE` x3, `bypassedBy: [MAGICAL]`, on an **active-effect** grant                                                                       |
| Wind Walk                     | Flying speed 300 ft                                                                                           | speed                 | `SPEED SET_VALUE` fly (exists)                                                                                                                       |
|                               | Resistance to damage from nonmagical weapons                                                                  | damage                | `DAMAGE_RESISTANCE` bludgeoning/piercing/slashing, `bypassedBy: [MAGICAL]`, `attackDomains: [MELEE, RANGED, UNARMED]` (a weapon attack, not a spell) |
|                               | Only Dash or revert; 1-minute reversion; 60 ft/round descent; up to ten willing targets                       | actions, movement     | action restriction and 10-target willing selection if existing options carry them; else description-only, registered                                 |

Verify each "if existing" at coding; a gap is reported, never special-cased.

## Qualifier shape

Two parts, because the spells use two different kinds of question.

**1. Who or what imposes it (creature type, magic).** Extend the existing modifier **restriction** condition `CREATURE_TYPE` with a `subject: 'HOLDER' | 'SOURCE'` (default `HOLDER`, so existing data is unchanged), and add a sibling condition `SOURCE_TRAIT { traits: MAGICAL... }` (the existing bypass-code vocabulary). `SOURCE` means the other party of the event the grant reads:

| Grant domain                                        | `SOURCE` is                                                                                      | Decided in                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `ATTACKS_AGAINST`, `ATTACK_ROLL` against the holder | the attacker; magical = the attack's trait                                                       | the `attacksAgainst` filter in `encounterActionMechanicsPreparation.ts` (attacker and attack traits already in hand) |
| `SAVING_THROW_MODIFIER`                             | the actor whose effect forces the save; magical = a spell or magic-item source                   | the save preparation beside `sourceSightSaves`                                                                       |
| `CONDITION_IMMUNITY`                                | the origin actor of the condition's owning effect; a GM-set condition has none and never matches | the condition binding in `encounterActionExecution.ts` (the folded list becomes entries with restrictions)           |
| `END_EFFECTS` `CONDITION` selector                  | the owning effect's source actor                                                                 | `selectedEndedEffects`                                                                                               |
| `MANIFEST` interaction trigger                      | the attacker                                                                                     | the retaliation filter                                                                                               |

A restriction that names a `SOURCE` condition and is read where no source exists fails closed, the existing rule in `holderConditionMatches`.

**2. How the damage arrives (defenses).** The defense payload gets the shape the stat block already uses: `DAMAGE_RESISTANCE`/`DAMAGE_IMMUNITY` `ADD_OPTION` payload `{ damageTypeId, bypassedBy?: DamageDefenseBypassCode[], attackDomains?: AttackDomainCode[] }`. The fold of active-effect grants writes qualified entries into the same `qualifiedDefenses` list the stat block feeds, so `profile.attackDamageDefenses` is the single evaluator; no second one.

Waiting tasks reuse it without further options: Fey Ancestry ("advantage on saves against being charmed", no source qualifier, plus "magic can't put you to sleep" = condition immunity with `SOURCE_TRAIT MAGICAL`), Gnome Cunning ("saves against magic" = `SAVING_THROW_MODIFIER` with `SOURCE_TRAIT MAGICAL`), Dwarven Resilience ("saves against poison" = `conditionTypeId` poisoned, existing; poison resistance is a plain `DAMAGE_RESISTANCE`; a future "damage-type source" trait would be one more `SOURCE_TRAIT` code), SPELLS-31/33 evil-creature wards (`CREATURE_TYPE` `SOURCE`).

## Alternatives

|                     | Idea                                                                                                                                                                                | For                                                                                                                                                                                                          | Against                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A (recommended)** | Restriction conditions with `subject: SOURCE` + `SOURCE_TRAIT`, and `bypassedBy`/`attackDomains` on defense payloads                                                                | One vocabulary for holder and source questions, OR-of-AND and `EXCLUDE` for free ("not celestials"), reuses the D152 authoring UI and fail-closed rule, no per-domain field; every waiting task is data only | Touches the restriction fold and three evaluation sites; the fold output of `CREATURE_TYPE` gains a field (stored plans migrate, dev data reseeded) |
| B                   | Per-domain fields: `attackerCreatureTypeIds` on `ATTACKS_AGAINST`, `sourceCreatureTypeIds` on `SAVING_THROW_MODIFIER` and `CONDITION_IMMUNITY`, copying the Nature's Ward precedent | Smallest diff per site, no restriction-fold change                                                                                                                                                           | Three-plus copies of one rule, no `EXCLUDE`, no OR, each new waiting task needs another field (`magical`, `poison`), exactly the drift D156 forbids |
| C                   | One new grant domain `SOURCE_QUALIFIED_GRANT` wrapping any modifier with a qualifier                                                                                                | Uniform wrapper                                                                                                                                                                                              | A second grant shape beside `APPLY_GRANT` modifiers, every consumer must unwrap it; plan-shape change ADR 0039 rejects                              |
| D                   | Keep the kinds closed, hard-code per spell                                                                                                                                          | Zero engine work                                                                                                                                                                                             | Rejected by D156                                                                                                                                    |

Recommend A. It is the only one where the waiting tasks need no new option.

## Schema, node map, compiler

- `packages/schema`: `CREATURE_TYPE` facet gains `subject`; new `SOURCE_TRAIT` predicate (traits validated against the System vocabulary at ingress as T9b does for `rollInfluence`); defense payloads gain `bypassedBy`, `attackDomains`; `END_EFFECTS` condition selector accepts `restrictions`.
- `packages/shared`: node map entries for the new predicate and payload fields; `CLOSED_RULE_KIND` drops the five kinds; `schema/src/effects/closedRule.ts` and `effects/maps/path.ts` follow.
- `packages/rules-runtime`: `holderConditionMatches` split into holder and source deciders; `encounterActiveGrants.ts` folds qualified defenses and condition-immunity entries; the three evaluation sites above. No new event, no new pause kind.
- Authoring: node map rules for the new fields; five SRD spells and Purity of Spirit re-authored in `packages/source-data`.

## Acceptance criteria (proposed, for confirmation)

1. A grant restriction can name the creature type or magical trait of the attacker, effect source or condition origin; it holds only for a matching party and fails closed where none exists.
2. An active-effect resistance can be limited to attacks without a bypass trait and to attack domains, through the one qualified-defense evaluator.
3. The five kinds and Purity of Spirit's use are deleted; each SRD effect compiles from core options; each has an authoring-parity proof (SRD plus a homebrew variant through the node map and the real compiler).
4. Room journey: Protection from Evil and Good in the Session Worker room: a fiend's attack has disadvantage, a bandit's does not, and Stoneskin halves a nonmagical sword hit but not a magical one.
5. Docs: `rules-runtime.md`, ADR 0038 consequences, decision entry.

## Tests (red first)

- `packages/rules-runtime/src/__tests__/sourceQualifiedGrants.test.ts`: attacker type, save source, condition origin, fail-closed, `EXCLUDE`.
- `packages/rules-runtime/src/__tests__/activeEffectQualifiedDefenses.test.ts`: Stoneskin and Wind Walk against magical/nonmagical and weapon/spell damage.
- `packages/authoring/src/nodeRuntime/sourceQualifierAuthoringParity.test.ts`: SRD effects plus homebrew variants (other types, other trait) pass unchanged.
- `packages/rules-runtime/src/__tests__/qualifierSrdCompilation.test.ts`: each SRD spell and Purity of Spirit compile from the catalogue.
- `apps/session-worker/test/nativeRoomSourceQualifiers.test.ts`: the room journey.

## Golden flips (expected)

Graph checksums of exactly: Protection from Evil and Good, Holy Aura, Dispel Evil and Good, Stoneskin, Wind Walk, and the Oath of Devotion feature Purity of Spirit (`CLOSED_RULE` becomes authored options). Stored plan shape for `CREATURE_TYPE` restrictions gains `subject`, enumerated when measured. Creature stat blocks that embed these spells by reference: expected unchanged, confirmed by the golden harness.

## What stays description-only

Possession (no condition), Holy Aura's dim light, Dismissal's home-plane banishment (until `BANISHMENT` converts), Wind Walk's reversion and descent mechanics unless existing options carry them. Each is registered as a roadmap item, none special-cased.

## Size

The ledger's 5 is low. Estimate **8** for the whole set: the restriction/subject change and three evaluation sites (3), qualified defenses on effect grants (2), four spells plus Purity of Spirit with parity proofs and golden flips (2), room journey and docs (1). Proposed split if the ruling prefers: **T2j** (5): attacker/source qualifier, qualified effect defenses, Protection from Evil and Good (with Purity of Spirit), Stoneskin, Wind Walk; **T2j2** (3): Holy Aura's rider and Dispel Evil and Good (Break Enchantment origin selector).

## Open questions for the ruling

1. Option A, B, or the split of A?
2. Size 8 in one slice, or the T2j / T2j2 split?
3. Wind Walk "damage from nonmagical weapons" authored as physical damage types from nonmagical weapon attacks (approximation), or all damage types?
4. "Possessed" stays description-only until a System condition exists. Agree?
5. Dismissal stays description-only with `BANISHMENT`. Agree?
