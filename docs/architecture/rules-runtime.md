# Shared rules runtime

> **Status:** canonical current guide for `packages/rules-runtime` and its callers. Phase 8.3 rules scope is target and labeled as such.
>
> **Scope:** the pure Rules Kernel, System capability contracts, published definitions, execution, frozen occurrences, decisions, receipts, and who calls the runtime
>
> **Update when:** graph contracts, primitive ownership, System capabilities, publication, occurrence, replay or receipt behavior, the package export surface, or a caller changes
>
> **Verification:** `packages/rules-runtime`, `packages/encounter-persistence`, `apps/session-worker/src` (`native*`, `room*`), `apps/apis/convex/{content,characters,encounters}`, `apps/web/src/domains/characters/builder/evaluation`, ADRs 0023-0026, 0029, 0034-0036, and [the RUL-9 rules audit](../handoffs/rul-9-rules-audit.md)

The Rules Kernel (`packages/shared/src/domains/rules`) is a pure execution library. It walks a validated
bounded graph, accepts explicit facts, random evidence and decisions, and returns typed proposals and a
trace. It does not authenticate users, read persistence, generate randomness, mutate aggregates, or know
D&D vocabulary. `packages/rules-runtime` wraps the Kernel with schema validation, installed System
modules (D&D 2014 today), and the pure Encounter, Character and Sheet calculations that callers share.
It owns no store and no transaction.

```mermaid
flowchart TD
  Draft["Typed authored draft"] --> Publish["Validated publication (Convex, authoring package)"]
  Publish --> Current["Current immutable definition"]
  Current --> Snap["Content snapshots (R2)"]
  Facts["Authorized stored inputs + explicit evidence"] --> Execute["rules-runtime execution"]
  Snap --> Execute
  Execute --> Decision{"More input required?"}
  Decision -->|yes| Freeze["Frozen occurrence + bounded decision contract"]
  Freeze --> Resume["Authorized resume with exact version"]
  Resume --> Execute
  Decision -->|no| Proposal["Validated typed proposals"]
  Proposal --> Commit["Owning authority transaction (room SQLite or Convex)"]
  Commit --> Receipt["Exact idempotent receipt"]
```

## Callers

- **Session Durable Object** (`apps/session-worker`): the `native*` modules (`nativeEncounterRules`,
  `nativeEncounterTurn`, `nativeEncounterMovement`, `nativeCharacterRules`, `nativeCheckAction`,
  `nativeContest`, and the Concentration, Cleaving and maintenance modules) plan and execute Encounter,
  movement and Sheet-play rules from the room's SQLite inputs, and the `room*` modules commit the results
  there. Held Sheet play runs through `roomCharacterSheetCommands` and `roomCharacterWrites`. See
  [live sessions](live-sessions.md) for the room protocol, ordering and recovery.
- **Browser Builder** (`apps/web/.../builder/evaluation/builderEvaluator.ts`): evaluates a Character over
  the content snapshot objects of its manifest with `createLazySnapshotReaders`,
  `resolveSnapshotCharacterBuilderPayload` and `previewSnapshotCharacterBuilder` (ADR 0036).
- **Convex Builder commit** (`characters/commit`, `characters/referencedContext.ts`): re-evaluates the
  Character on the server from the referenced current publications through
  `assembleCharacterReferencedBuilderContext`. It is the authoritative check behind the browser's
  evaluation.
- **Other Convex use:** publication and reads that need pure rules code. `content/definitions` composes
  `@artificer-toolkit/authoring/reusableDefinitions`; `content/systems` serves System capabilities from
  `platformRulesRuntime`; Sheet and Campaign Sheet queries and commands use `rules-runtime/character/*`;
  `encounters/actionChoices` and the disarm selection read action sources, economy and wield conflict;
  projection reads use `encounterProjection` and `encounterPlayerProjection`. Convex no longer runs
  per-command Encounter rules: that path was deleted in A35-S6c3
  ([ADR 0035](../adr/0035-room-authoritative-live-encounters.md)).
- **`packages/encounter-persistence`:** admission, persistence writers, receipts and projections for
  Encounter state, over a store interface. It depends on this package, never the reverse; see
  [persistence](persistence.md).

## Package surface

`packages/rules-runtime/package.json` exports `"."` (the `rulesRuntimeService` module only:
`createRulesRuntimeService` and its error classes) and `"./*"`, which maps any module path under `src` to
`dist` (for example `rules-runtime/encounterActionSources`, `rules-runtime/character/sheetPreparation`,
`rules-runtime/systems/dnd5e/attackKind`). Consumers import focused subpaths, not the root. Build the
package before tests that import newly added modules.

| Area                          | Modules                                                                                                                                                                                             | Owns                                                                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Execution wrapper             | `rulesRuntimeService`, `platformRulesRuntime`, `platformPolicyModules`, `systemCapabilityRegistry`, `*Capability*`, `platformEncounterPolicy`, `platformCharacterPolicy`, `random`                  | Schema-aware Kernel execution, frozen-graph admission, installed System lookup by System UUID, fail-closed System capability registries                                      |
| Systems                       | `systems/dnd5e/*`                                                                                                                                                                                   | D&D 2014 policy, action compiler, grant fold, modifier scope, concentration, lifecycle and optional-combat policy                                                            |
| Character                     | `character/*`                                                                                                                                                                                       | Context and Sheet preparation, Builder catalogue/eligibility/reconciliation/readiness/payload, snapshot readers, Sheet commands, rest, roll, projection, rule-fact composers |
| Encounter actions             | `encounterAction*`, `encounterBasicActions`, `encounterDisarmPreparation`, `encounterWieldConflict`, `encounterCleaving*`, `encounterConcentration*`                                                | Source resolution, mechanics preparation, economy, target policy, effects, receipts, warnings                                                                                |
| Encounter turn and initiative | `encounterTurn*`, `encounterInitiative*`, `encounterRecharge*`, `encounterLegendary*`, `legendaryActionEligibility*`                                                                                | Initiative graphs and settlement, turn effects, Recharge, Legendary Actions                                                                                                  |
| Encounter movement            | `encounterMovement*`, `encounterSpatialMovement*`, `movementReaction*`                                                                                                                              | Path timeline, Passage contacts, reaction discovery, decision and settlement planning                                                                                        |
| Encounter state               | `encounterActor*`, `encounterMechanicsBatchPlan`, `encounterCharacterMechanicsBatch`, `encounterScalarReductions`, `encounterProjection`, `encounterPlayerProjection`, `encounterCombatPerception*` | Actor facts and state, outcome folds, projection, perception                                                                                                                 |
| Snapshots and misc            | `contentSnapshots`, `contentCatalogue`, `campaignClock`, `sceneGridPolicy*`, `targetBoundActiveRuleEffectExecutor`, `characterRuleActionSystemAdapter*`                                             | Content snapshot build/index shapes, clock boundaries, grid policy, frozen active-effect execution                                                                           |

Everything here takes structural inputs (domain types, injected readers, ports). None of it imports
Convex contexts, database rows, or Worker APIs, so the room and Convex run the same functions.

**Installed-System classification (RELIABILITY-6.16, current).** Generic Worker, encounter-persistence
and rules-runtime code never imports the D&D Concentration maintenance id or melee classification. It
asks the installed System for the Run's `gameSystemId` through `platformRulesRuntime`:
`requireInstalledConcentrationMaintenanceDefinitionId` and `isInstalledMeleeAttackTrigger`, both
registered by the System module (`systems/dnd5e/characterActionRuntime`). An unknown System fails
closed.

### SRD effect compile golden (current, RULES-2.T2)

`packages/rules-runtime/src/__tests__/srdEffectCompileGolden.test.ts` compiles every authored SRD Effect, found by
parsing nodes with the authored Effect schemas, through the entry point its owner uses in play, and compares one line
per Effect with `__tests__/__golden__/srdEffectCompile.golden.txt`, sorted by Effect id: `<effect id> <owner kind>
<owner label> | <outcome>`.

- `CREATURE`: Creature action discovery (the Encounter's path), then `compileEncounterFeatureActionPlan`. An Effect
  discovery does not list as an action reads `NOT_A_DISCOVERED_ACTION`. The checksum includes the Effect's real id.
- `CHARACTER:<subject>`: a Character action descriptor over the compiled Effect, then
  `compileExecutionPlan`, at Character level 20 and, for a spell, its own level. The Effect is compiled under the
  descriptor's fixed id, so the checksum does not depend on the Effect's own id.
- Outcome: `SINGLE_GRAPH <graph checksum> nodes=N outputs=M`, `TEST_OUTCOME test=<checksum> nodes=N outputs=M
  outcomes=[<path>=<checksum>,...]` or `REFUSED <error name>: <message>`.
- Scaling variants of a Character-owned Effect (`<id> @L1`, `@L5`, `@L11` at that Character level, `@U9` for a leveled
  spell upcast to 9th level) appear only when their outcome differs from the base line. Most scaling is bound at
  execution from facts, so few variants differ; a new one is a scaling change.

Reading a diff: a changed checksum means the compiled graph for that Effect changed; changed `nodes`/`outputs` show
its size; `SINGLE_GRAPH`/`TEST_OUTCOME` flipping is a plan-shape change; `REFUSED` or `NOT_A_DISCOVERED_ACTION`
appearing or disappearing is a support change; a variant line appearing or vanishing is a scaling change. A refactor
slice (RULES-2.T6a-f) must keep the file green. If a line must change, the slice's review explains every changed
checksum and reseeds development data in the same change, because published graphs and frozen occurrences carry
these checksums. Regenerate with `vitest run -u` on that test only. Passive Creature traits compiled by other
adapter methods (zones, damage grants) are not covered.

### Effect-action compiler module map (current, RULES-2.T6b)

`systems/dnd5e/effectActionCompiler.ts` compiles an authored Effect and holds the adapter. Its operation registry and
its runtime interpretation (the code that re-checks a committed graph's evidence and returns the applications) live in
sibling modules. Imports run one way, down this list; no module imports the compiler, and none re-exports another's
names.

| Module                           | Owns                                                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `effectActionContracts`          | The `DND5E_*` operation and fact keys, the compiler error, the `Outcome` and path types, forced-movement collision encoding, node-id helpers                                                                   |
| `effectActionOperationRegistry`  | Every `dnd5e*Operation` contract, their factories, and `dnd5eEffectActionCapability`                                                                                                                           |
| `effectActionOutcomes`           | `DND5E_EFFECT_OUTCOMES`: one outcome definition per `Outcome` kind (see the outcomes registry below), and the key sets interpretation derives from it                                                          |
| `effectActionEvidenceChecks`     | Pure checks shared by interpretation: condition immunity facts, hit-point gate evidence, repeat-save condition ids                                                                                             |
| `effectActionInterpretation`     | `interpret`, `interpretDirect`, `interpretDirectProposal`, `interpretSpatial` and `testApplications`, which call one another and so share a module                                                             |
| `effectActionRepeatSaveEvidence` | `repeatedFollowUpSaveResultPath`: the repeat-save result path a committed save trace must carry                                                                                                                |
| `effectActionScalingFacts`       | `Dnd5eEffectScalingFacts`, built once by `dnd5eEffectScalingFacts` where locked facts enter the compiler; `scalingLevel`; the bounded exact-dice contract (`parseBoundedDiceConfiguration`, `boundedDiceTerm`) |

The scaling facts are validated at that one boundary: a level the contract carries is a positive safe integer, class
levels are a validated map, and the roll mode is always present. Downstream compiler code reads them without re-checking.
A parsed dice configuration is one bounded term plus its flat modifier, so callers never re-check the term's bounds; only
a critical hit's doubled count is re-bounded.

All seven are D&D 2014 policy (their keys, messages and facts name D&D), so they stay under `systems/dnd5e`. The
first neutral piece is the outcomes registry below; the interpretation dispatcher is a later RULES-2 step once the
compiler stops naming D&D facts. Each file stays under the 1,500-line budget, and the golden above gates every move.

### Effect outcomes registry (current, RULES-2.T6c1–T6c2; ADR 0039 decision 1)

The neutral `effectOutcomeRegistry` replaces the per-kind proposal-node ladders. An `EffectOutcomeDefinition` names
one outcome kind's direct proposal, its path-gated proposal (or null), its payload bindings and output ports, and
whether it changes stored target state. Every phase builds its node through `effectOutcomeProposalNode`: `DIRECT` (no
test, or the selected outcome graph of a split test) or `PATH_GATED` (a branch of an inline test, which adds
`resolvedPath` and `authoredPath`). So an outcome composes with any test phase without a per-kind branch, and a new
kind is one registry entry. `pathGatedProposalOperation` wraps any direct proposal contract into its path-gated form:
authorized only while the base authorizes and the System's path rule holds (`dnd5eResultPathSatisfies`: the exact path,
or a critical hit satisfying a hit).

`systems/dnd5e/effectActionOutcomes` holds the D&D entries. Interpretation derives its maps from them: path-gated to
direct proposal, the direct outcome keys and the stateless keys (outcomes an active effect, the room or the triggering
event owns, which settle no target application). A path-gated proposal's interpretation re-checks every published
literal of its payload, then interprets it as its direct proposal.

`MODIFIER_GRANT`, `ACTOR_LINK`, `CREATURE_FORM`, `CONCEAL` and `DETECT_CONCEALED` have no path-gated form: their state
lives in an active-effect plan, not in the test graph. A plan authored on a test's result path carries a **result
gate** (current, RULES-2.T6d1): `resultGate.paths` lists the resolved paths that make it, which the System compiler
fills from its path rule (`dnd5eResultGate`: an authored `ON_HIT` lists `ON_HIT` and `ON_CRIT`). The neutral
`prepareRecurringActiveEffect` makes the effect only when the test's `d20.resultPath` is one of them, for every
contribution kind, with no System import. It replaced the per-kind `grant-authored-path` and `form-authored-path`
facts; a relationship keeps `relationship-authored-path` only as its application trace's `authoredPath`. So a grant
on a hit or a miss, and a link or a creature form on either save result, compile under a test. `CONCEAL` and
`DETECT_CONCEALED` stay refused under an attack or a save, for a rule: they are settled from the holder's own check
total, which neither test produces. `KILL` under a test stays limited to hit-point tiers, which is also a rule.

**Effect lifetime (current, RULES-2.T6d1).** An active-effect plan's lifetime is its neutral fields: the clock
(`recurrenceStage`, `initialRemaining`, `tickAnchor`), the repeat (`saveThresholds`, `lifecycle.repeatTriggers`), the
ends (`lifecycle`) and `resultGate`. D&D builds the repeated save of every follow-up flavour (the action's own
recurring save, a failed save's or a cast's follow-up, a hit's nested save, and a placed zone's save) through one
builder, `dnd5eRepeatSave` in `systems/dnd5e/effectActionFollowUp`: ability, pinned DC (a fixed DC in the plan, the
caster's DC as a cast fact), request node, held and escalating conditions, and the perception roll influence or
attempt gate. `conditionDurationTurns` there is the one turn count for a timed duration. The compiler picks a plan
through `repeatingFollowUpSavePlan` (the save repeats) and `timedActiveEffectPlan` (the duration counts) in one order,
shared by `dnd5eActiveEffectPlans` and the Concentration check.

**A hit's nested save (current, RULES-2.T6d2).** `immediateFollowUpSaveGraphDefinition` rolls the nested d20 and
the save's one shared damage roll, then composes each band (`ON_SAVE_FAIL`, `ON_SAVE_SUCCESS`) from the outcome
registry as path-gated proposals on `nested-save-test`'s result path, so any outcome the registry admits under a test
works on either band ("half as much damage on a successful one" is the success band's `multiplier: 0.5`). Each
band's conditions read their own path's immunity facts in authored order; a failure-margin rider's conditions follow
the failed band's. Interpretation verifies each nested proposal against its path-gated operation
(`dnd5ePathGatedProposalOperations`) and settles it as its direct operation with the nested paths kept. A halved roll
of 1 proposes 0 damage.

A test admits the same target-only outcomes the direct path does (RULES-2.T6c2): `STABILIZE`, `MANUAL_ADJUDICATION`,
`ADD_SPEED_TO_MOVEMENT` and a target's `DEPART` (a linked-location or special-destination teleport), alongside the
damage, heal, condition and hit-point-tier `KILL` outcomes. `dnd5eTargetOnlyOutcome` is the one home for that set, so
the compiler's direct and test admissions cannot drift. The commit-side readers (`executionAddsSpeedToMovement`,
`executionTeleportAllowance`, `executionCancelsTriggeringEvent`) find their proposal through
`dnd5eResolvedProposalTrace`: the direct key, or the path-gated key only when its trace output is authorized, so a
test that resolved to another path commits nothing. Under a test, two outcomes stay refused for their own rule: a self
teleport, which takes its reach from a self-targeted action's range, and `CANCEL_TRIGGERING_EVENT`, which belongs to a
spell-cast reaction and a spell-cast reaction is never a test activation.

## Ownership and publication

Game System adapters own rules vocabulary and policy, including D&D 2014. Reusable mechanics remain
portable typed operations. Code-owned operation keys, versions, validators and bounded graphs keep
authored data from introducing executable code or unbounded work. The System UUID selects the adapter;
labels, editions and catalogue codes never do.

Published authored roots and reusable definitions keep stable UUID identity. A reusable definition has at
most one editable draft and zero or one current published document. Publication atomically replaces the
current document, checksum and contract tuple and removes the draft; there is no historical revision
table or consumer-selectable pin. Issued occurrences keep their frozen execution evidence
([ADR 0024](../adr/0024-current-published-authored-content.md)).

`@artificer-toolkit/authoring/reusableDefinitions` is the single persistence-independent publisher. It
receives installed System capabilities, operation contracts, vocabulary and a store with atomic draft and
publication callbacks; Convex `content/definitions` and `content/definitionStore` supply the store.
Family keys live in `schema/shared/reusableDefinitionIdentity`: `rules-runtime-graph`, `sense`,
`rule-capability`, `condition-rule-state`, `rule-maintenance`, `initiative-policy`,
`dnd5e-encounter-lifecycle` and `dnd5e-optional-combat`. A family stores its own typed document: the graph
family holds the executable graph, `sense` holds a closed composition of code-owned perception primitives.
Unknown families are rejected. The checksum codec is `@artificer-toolkit/shared/canonicalJson`.

Publication validates graph bounds, cycles, ports, operation versions, UUID references, same-System
compatibility and transitive dependencies. That proves an invocation is structurally executable, not that
a live command will succeed.

Graph constraints: graphs are finite, bounded, acyclic and typed; node IDs are local structure; primitive
keys are code-owned while referenced definitions and domain items are UUID-backed; rule-to-rule
composition is an explicit validated reference; unknown operation versions, unbound ports, cross-System
references, cycles and incomplete branches reject publication.

Capability discovery derives entry points from actor sources, grants, equipment, effects, Campaign policy
and Scene facts, and an execution instance exists only when an entry point is invoked. An authored Effect
UUID is the stable identity of an effect-backed entry point. The shared boundary compiles the exact
authored Effect before the System adapter runs; the adapter may derive System policy facts from it but
cannot rewrite it. Creature discovery isolates each action: one whose mechanics cannot compile or bind is
listed unavailable with its reason while the Creature's other actions still work. There is no persistent
prepared-plan layer; a derived action list is never authority and every command repeats capability and
authorization checks.

## Execution, decisions, and receipts

An authorized command creates or resumes an aggregate-owned occurrence. A paused occurrence stores its
snapshot: the reachable graph, operation keys and versions, source identities and checksums,
frozen facts, issued requests, authority and redaction policy. Resume rejects stale authority, an
unexpected aggregate version, or a decision outside the stored contract. A continuation never leaves the
server and carries no seal (Q23, [ADR 0029 Amendment 1](../adr/0029-convex-backend-cutover.md#amendment-1-2026-10-17-unsealed-continuations)):
resume admits its graph exactly as frozen execution does (installed capability, matching contract
version, `validateCompiledRuleGraph`). A pending snapshot is
either `KERNEL_EVIDENCE` (the continuation plus a bounded server-only context) or `AGGREGATE_CHOICE`
(one closed tactical choice, no graph). An Encounter has at most one pending occurrence, and a retry
matching a stored receipt returns it before that gate.

A complete execution returns proposals. The owning authority applies them with the aggregate's expected
version, advances the occurrence and writes the receipt in one transaction; any failure leaves prior state
visible, and an exact retry returns the stored receipt without new randomness, current-definition reads or
double application. For live Encounter, movement and held Sheet play the owning transaction is the room's
SQLite commit; Convex receives fenced checkpoints
([ADR 0035](../adr/0035-room-authoritative-live-encounters.md),
[ADR 0029](../adr/0029-convex-backend-cutover.md#live-rules-execution-clarification--2026-09-24)).
Convex still owns the Builder commit, personal Sheet commands and Run creation.

Receipts retain committed results and evidence for retry and audit, never an executable graph. A resume
that advances or re-pauses writes a closed command-specific result holding only the actor-filtered summary
needed to replay that response. Character events caused by one occurrence use deterministic child command
UUIDs derived from the occurrence, root command, phase, ordinal and Character, so repeated phases never
reuse an idempotency key. Raw Kernel facts and traces are server-only; browsers receive recipient-safe
projections.

**Automation modes (ADR 0034).** There are two: Assisted and Manual. In Assisted, a step needing dice asks
the roller's `userProfiles.autoRollDice` preference: on records app-roll evidence immediately, off pauses
for entered dice. The roller is the actor whose roll it is; its assigned player's preference applies, else
its first granted controller's, else the GM's (`readEncounterAutoRollByActorId`). Lifecycle functions take
an `EncounterEvidenceMode` (`AUTO_ROLL | PROMPT | MANUAL`); answers arrive as `EncounterEvidenceAnswer`
and only `resolveEncounterD20Answer` and `resolveEncounterIntegerAnswer` turn one into faces.
**One d20 test settlement (ADR 0039 decision 2, current).** `encounterD20Settlement.ts` owns it: a
test freezes its roller facts with `freezeD20Context` (mode, contributors and their checksum, modifier,
added dice and floor when present); `settleEncounterD20Answer` settles an answer against that context
(faces, kept mode, added dice); `settleEncounterD20Test` resumes the test graph with the kept natural
and the added dice's total and verifies the System-named `rawDie`, `addedTotal` and `total` output
ports. Tests whose graph can pause again or is verified through its trace (action phases, target-bound
effects) resume through `resumeEncounterD20` directly. D20
evidence records both the chosen and the rules-derived roll mode, and pending summaries name the
contributors behind the derived mode (`encounterRollModeReasons`, labeled for display by
`rollModeReasons` in `packages/encounter-persistence`). **Typed contributor source (RELIABILITY-6.9,
current).** Every recorded d20 contributor (`D20Contributor`) carries a `source: { kind: ACTIVE_EFFECT
| CONDITION | AUTHORED | RULE, id, holderActorId }` beside its opaque `sourceId`, `grantId` and
`domainKey`; the checksum covers it. A reason label is a lookup by `rollModeSourceKey(source)`; no
consumer parses `sourceId` or `domainKey`. An active effect has one `sourceId`
(`createCharacterMechanicSourceKey`) and one typed source whichever holder, perception or relationship
path names it. Rules-owned contributors use kind `RULE` with an id from `ROLL_MODE_RULE_SOURCE_IDS`.
**Roll-mode capability (RULES-2.T7, current).** A contributor's `influence` is an opaque System
vocabulary code. Neutral runtime resolves a d20's contributors to a roll mode and the face to keep
(`FIRST | HIGHER | LOWER`) through `rollModeCapabilityRegistry.resolveRollMode({ gameSystemId,
contributors })` (`rollModeCapabilityRegistry.ts`, installed in `platformPolicyModules.ts`), which fails
closed on a System with no roll-mode policy, an influence code the System does not define, and a
duplicate or non-UUID adapter identity. The D&D adapter (`systems/dnd5e/rollModePolicy.ts`) defines
`ADVANTAGE`/`DISADVANTAGE` and their cancellation; `systems/dnd5e` and `character/` code call
`resolveDnd5eRollMode` directly. The schema wire enums still carry the D&D codes until RULES-2.T9.
**System capability registries (RULES-2.T11a–g, current).** Every System capability is one
`createSystemCapabilityRegistry(capability, adapters)` (`systemCapabilityRegistry.ts`) whose
`require(gameSystemId)` canonicalizes the UUID and fails closed on a System that does not provide the
capability; a duplicate or non-UUID adapter identity throws at install. `find(gameSystemId)` is for
optional capabilities only, where the rule is valid for a System without the capability (the Sheet's 0
hit point condition, D63); Encounter callers use `require`. The adapter interfaces live in
neutral files (`actionEconomyCapabilityRegistry`, `abilityScoreCapability`,
`creatureConditionCapability`, `initiativeFactAdapter`, `armorClassCapability`,
`d20TestDefinitionCapability`, `contestCheckCapability`, `optionalCombatPolicyCapability`,
`attackProfileCapability`, `modifierScopeCapability`), the D&D adapters in `systems/dnd5e/`, and
`platformPolicyModules.ts` installs them as `rollModeCapabilityRegistry`,
`combatPerceptionCapabilityRegistry`, `actionEconomyCapabilityRegistry`, `abilityScoreCapabilityRegistry` (modifier formula, abilities a
Creature form keeps) and `creatureConditionCapabilityRegistry` (0 hit point and exhaustion conditions) and
`characterActionCapabilityRegistry` (the Sheet's Character action discovery,
`discoverCharacterActionCapabilities`).
The Sheet reaches `platformPolicyModules`, so Encounter-only adapters install in
`platformEncounterPolicy.ts` instead (`initiativeCapabilityRegistry`; `armorClassCapabilityRegistry`
for a Creature's loadout armor class and the shield a two-handed grip stows;
`d20TestDefinitionCapabilityRegistry` for the basic action check and death save graphs and their
added-dice facts, where a System without death saves omits `deathSaveDefinition`;
`contestCheckCapabilityRegistry` for the two-participant contest graph and its modifier fact keys;
`optionalCombatPolicyCapabilityRegistry` for Disarm, Overrun, Tumble and Cleaving, where a sealed
action or passage choice uses `require` and Cleaving uses `find`, since a System without optional combat offers no
Cleaving choice; `attackProfileCapabilityRegistry` for an attack's kind and modifier domain, the
traits a holder's grants or a Character's action give it, its critical rules and roll contributors,
the damage defenses it meets, the itemless restrictions a feature attack reduces and what its compiled
effect reads and spends; `modifierScopeCapabilityRegistry` for whether a grant-fold modifier applies
Character-wide, which movement passage and opportunity-attack immunity read;
`characterRuleActionSystemAdapterRegistry` for compiling, binding and interpreting rule actions and
frozen active effects, where entry-point compilation and perception use `find` because a System
without it plays its entries manually; `encounterFeatureActionCapabilityRegistry` for feature action
discovery and effect binding (`encounterFeatureActionCapabilityDiscovery.ts`);
`legendaryActionEligibilityCapabilityRegistry` and `movementReactionEligibilityCapabilityRegistry`
for eligibility and the capability definitions it requires; `sceneGridPolicyCapabilityRegistry`, an
optional `find` capability through `resolveEncounterSceneGrid`, where a System without it plays on the
Scene's own grid). The four `platform*` files are the only composition roots: no other neutral
module installs an adapter, and a `systems/dnd5e` adapter never value-imports a platform file, so
`passiveMeleeRetaliationZone` takes the attack kind instead of reading the registry. A `MovementTarget`
carries its actor's `movementPassage` and `grantedAttackTraits`, resolved once through these
registries from the Run's `gameSystemId`. Sealing and currentness of a pending contest, the optional action selection contract
(`encounterOptionalCombatActionSelection.ts`) and the Scene's enemy-proximity and move-toward facts
are System-neutral (`encounterContestPendingContext.ts`). Encounter persistence rebuilds a stored
contest's graph through `contestCheckCapabilityRegistry` from the Run's `gameSystemId`. Installing them there keeps Encounter modules out of
the browser (ADR 0036 S6, `apps/web/src/lib/rulesRuntimeBoundary.test.ts`). Ability id↔code stays System vocabulary data (`system.abilities`).
Neutral modules reach System behaviour only through these registries; the `systems/*` import
allowlist (`scripts/systemsImportAllowlist.json`) only shrinks and, since RULES-2.T11e, also fences
Encounter persistence, the Worker, Convex and web; the composition roots above are exempt by name
([CI validation](ci-validation.md)).
Attack-perception contributors are `rule:unseen-attacker`
("Unseen attacker", advantage) and `rule:unseen-target` ("Unseen target", disadvantage); see Combat Perception. A player's prompt never names a contributor from an actor hidden from
players (it reads "Unseen source"); known limit: a contributor from the roller's own policy is never
redacted. Manual mode records an idempotent receipt at an unchanged version without invoking the Kernel or
applying state and carries no rules cue (ADR 0034). **One card per die (ENCOUNTER-7, current).** Every
Encounter rule die posts exactly one roll card through `recordRuleRollCard`: an action's d20s and damage
totals, a Legendary Action's (`recordActionRollCards`), each Recharge d6 (source kind `RECHARGE`), the
turn-start death save and, under `DECLARED_ACTION_ROLL`, each declared actor's initiative die (ENCOUNTER-9,
the same `INITIATIVE` card `ROLL_ACTOR_INITIATIVE` posts, both built by the one `initiativeRollRecord`,
written by `persistEncounterInitiativeRollCards` in the terminal turn commit from the settled
`root.initiative` evidence; a flat score and tie-resolution dice post none, and a result of more than two
dice or a die that is not a logged `1dN` throws. **Declared advantage and disadvantage (ENCOUNTER-10,
current):** the declared graph's `d20-extra` node (`evidence.optional-integer-range`, which asks for its
die only while the `initiative.extra-d20` fact is true) and its `number.keep-one-of-two` node roll two
d20s and keep the first, higher or lower face the `initiative.keep` fact names (the D&D roll-mode policy
maps the resolved mode to it); the card replays both faces under
that mode, so it matches the GM-rolled card. A tie resolver pinned to the same graph rolls its attempts
the same way.) A die settled by a `SYSTEM_ROLL` answer already has its
"Rolled by the app" attempt card, so the commit skips it; an auto-rolled or entered die (including one
entered after an app roll) is carded at commit. `readAppCardedDice`
(`packages/encounter-persistence/src/appCardedDice.ts`) decides this
from journaled answers, never from die values: each `SYSTEM_ROLL` answer (an action's `ACTION_EVIDENCE`
receipts, a turn root's `resolutionCommands`, `LEGENDARY_SYSTEM_ROLL` for Legendary windows,
`INITIATIVE_SYSTEM_ROLL` for declared initiative) is joined to
its latest attempt and covers at most one settled die of the same request and value.
Known limit: an app-rolled single-die damage request also gets a commit total card.
Actions in a Manual Encounter are refused with the
`ASSISTED_ONLY` domain rejection.

**Active effects and maintained state.** Current active effects are state, not occurrences. Each stores an
immutable definition (origin, one frozen `SINGLE_GRAPH`, adapter facts, recurrence, perception
contributions, and an aggregate-state `stateContributions` list that is empty for an effect that only ticks)
and a mutable lifecycle (remaining ticks). The definition has one schema version, `schemaVersion 2`
(current, RULES-2.T16): version 1, an effect with no `stateContributions`, was deleted outright rather than kept for
compatibility (pre-launch, no live rows), and every producer, fixture and seed writes version 2. A change to the stored
definition shape adds the next version and migrates its producers in the same change. The pure executor
(`targetBoundActiveRuleEffectExecutor`) executes the frozen graph without current-definition lookup and
returns a lifecycle `UPDATE` or `EXPIRE` proposal for the owner to apply. Maintained-effect state
(Concentration) is generic persistence keyed by a System maintenance-definition identity; the System
decides whether a mechanic uses it. Storage layout and limits are in [persistence](persistence.md).

## Assisted soft enforcement and GM undo (current, ADR 0034 decision 2)

`RESOLVE_ACTION` evaluates its overridable checks once, in the room planner (`nativeEncounterRules`),
through `encounterActionRuleWarnings`:

- `prepareEncounterActionMechanics({ overridable: true })` reports `SOURCE_NOT_EQUIPPED` and
  `RESOURCE_UNAVAILABLE` instead of refusing;
- `evaluateEncounterActionEconomy` reports `ACTION_ECONOMY_UNAVAILABLE`;
- `evaluateEncounterActionTargetPolicy` reports `TARGET_OUT_OF_RANGE` (or `TARGET_RANGE_UNCHECKED`
  without both tokens), `TARGET_DISPOSITION` and `TARGET_DEFEATED`. Disposition compares the GM-set
  dispositions through `encounterActorRelationship` (neutral is neutral to everyone, equal dispositions
  are allied, friendly and hostile are hostile). It is the one source of hostility: movement reaction
  eligibility and passage blockers use it, and Run state stores no side relationships. Actor sides remain
  only for initiative grouping, reorder, reinforcement and removal.

**Targeting yourself (D99).** A user may target itself unless the action says otherwise: the policy raises
`TARGET_DISPOSITION` for a self target only when the target disposition is hostile, the action makes an
attack roll (`makesAttackRoll`, a required policy input) or the authored single-target `self` field is `WARN`
("another creature"). `self` is one authored field with three values: `ALLOWED` (the default), `WARN` (the
overridable warning above; SRD Bardic Inspiration, Healing Touch, Modify Memory and Protection) and `REFUSED`
(Help and First Aid: the policy refuses a self target outright as `UNSUPPORTED_TARGET`, not acknowledgeable). The
action choice DTO's `target` is the authored targeting, not a derived flag: `{ kind: 'SELF' }` for a `SELF`
selection (Dash, Dodge; no picker, resolves on the actor), `{ kind: 'ACTOR', self }` for a creature-choosing
selection (the schema's `ALLOWED | WARN | REFUSED`, `ALLOWED` where the selection has no `self` field) and
`{ kind: 'POINT', area }`. A client always asks for the creature of an `ACTOR` target; it lists the user unless
`self` is `REFUSED`, and the server keeps the `WARN` warning.

**Rule usage storage.** "Nothing used" has one stored form: no key. `withEncounterRuleUsageUsed` drops the
definition's entry for a usage of 0 and drops an empty `ruleUsage`, so a turn refresh, a spend and an undo
store the same row.

An authored basic action follows the same rule through `RESOLVE_ACTION`, with `encounterActionEconomyWarnings` and `TARGET_DISPOSITION`.
Action choices carry the warnings that already apply before a target is chosen.

### Attack action, Multiattack and Extra Attack (current, D93)

An Assisted weapon or unarmed attack made with one Action is part of the actor's Attack action
(`isAttackActionAttack`, owned by the System's action-economy adapter; spell attacks are not).
`evaluateEncounterAttackAction` wraps the Action evaluation: the first such attack of a turn spends the
Action and opens the Attack action, stored at actor `resources.attackAction` with the turn sequence, its
slot `alternatives` and the attacks made (each with its Feature, target ids, target size and, once
settled, whether it hit). The next attacks of that turn fill it without spending an Action or warning.
The alternatives are the implicit one slot of `ANY_ATTACK` times the dnd5e policy output
`attacksPerAttackAction` (value domain `ATTACKS_PER_ATTACK_ACTION`, SET_VALUE only, highest source wins,
base 1; every class Extra Attack and Thirsting Blade is a grant of it), plus every alternative a
Creature's Features author as `attackSlots` (`packages/schema/src/features/attackSlots.ts`, authored in the Creature editor from the Creature-only `attackSlots` group of `CREATURE_FEATURE_NODE_MAP`, ATTACK-11.3): slots with a
`count`, `fillers` (a Feature or `ANY_ATTACK`), `optional`, `comesFirst` and one generic `condition`
(`EARLIER_SLOTS_HIT_SAME_TARGET`, `TARGET_SIZE_AT_MOST`; an unknown size passes). A Feature that fills a
slot is tracked in the Attack action; a swap ("instead of its bite") is a further alternative. An active
`ATTACKS_PER_ATTACK_ACTION` cap limits the attacks of any alternative. `evaluateAttackSlots`
(`encounterAttackSlots.ts`) decides in order whether the attacks so far still fit an alternative and
whether a required slot is left (`incomplete`). The action drawer drops a slot-filling action that fits
no alternative while the open Attack action is incomplete (`blocked`) and a Recharge filler with no
charge left; nothing names a Creature. An attack that does not fit (full, stale turn) spends a new
Action, warns when none is left, and opens a new Attack action. Settlement finalizes the transition with
the attack's `hit` (`settleEncounterAttackActionHit`) before it is committed and receipted. Settlement commits the `attackActionTransition` `{ before, after }` in the
action's mechanics batch with the same compare-and-set as the allowance; `REVERT_LAST_ACTION` restores
`before` only while the actor still holds `after`, else it refuses with `REVERT_UNAVAILABLE`. Action
choices report `attackSlot` per action and the actor's `openAttackAction` (`made`, `total`, `complete`:
no required slot left, so every offer with an `attackSlot` is optional). A slot filler is tracked and
blocked only when it spends the Action (`spendsAttackAction` on the adapter); the same Feature used as a
Bonus Action, Reaction or Legendary Action is unaffected by the open Attack action. The drawer's "Done
attacking" is client-only: it collapses the remaining-slots panel and drops the preselection while the
server keeps the action open until the turn ends. A filler attack spends nothing
but still honors suppression: `isActionEconomySuppressed` reuses the allowance capability resolution of
`evaluateEncounterActionEconomy`, and an actor that can't act (Incapacitated, a suppressing effect) gets
the overridable `ACTION_ECONOMY_UNAVAILABLE` warning and no `attackSlot`; a spent Action is not
suppression. Manual mode tracks nothing.
Every SRD Multiattack authors its slots as data (D93); the stat-block audit (`creatureStatBlockAudit.ts`) fails a Multiattack with none.

The command proceeds only when `acknowledgedWarnings` (part of its fingerprint) covers every current
code; otherwise it is refused with `RULE_WARNINGS`. An override spends only what remains and
`consumeEncounterActionEconomy({ overridden: true })` lets the allowance exceed its maximum. Accepted
warnings are stored as `ruleOverrides` and badged on the timeline. Authorization, versions, the current
actor, Manual mode and completed Encounters are hard checks, never warnings. Reactions, Legendary
Actions, Disarm and movement call preparation with `overridable: false` and keep refusing.

`REVERT_LAST_ACTION` (GM-only) undoes the Run's last `RESOLVE_ACTION` and its committed child receipts,
inverting only recorded before-states (hit points, conditions, resource usage, a stowed shield, a used-up single-use item (given back by lowering its `itemUsage`), item corrosion, of the target's worn item or (`subject` ATTACKER_WEAPON, on an `INCOMING_WEAPON_HIT` passive) of the weapon that hit, carried by `targetItemDegradation` or `sourceItemDegradation` (`CharacterInverse.degradation`, restoring the `itemDegradation` penalty and any destroyed-item `itemUsage`), charges,
the action allowance, created effects and maintained states). It refuses, naming the kind, removed
conditions, replaced maintained effects, lost Concentration, Cleaving damage to a Character, Disarm and
other contested actions (a contested `ESCAPE` too); a second undo is refused. Its implementation is
`packages/encounter-persistence/src/actionRevert.ts`.

### Point-area actions (current, D103)

A POINT-target action over an area-contents plan opens one pending `ENCOUNTER_AREA_ACTION`
(`AGGREGATE_CHOICE`) occurrence. `catchEncounterAreaActorIds` picks the actors with a token overlapping the
area, once each, and `encounterAreaCaughtChecksum` seals the Scene version, the area and those creatures.
Each caught creature carries its own sealed single-target save under
`encounterAreaTargetOccurrenceId(area, actor)`; `prepareEncounterAreaTests` opens them all without rolling
damage and `answerEncounterAreaTest` answers one whatever the others have done. `removeEncounterAreaTarget`
(the GM's removal, SPELLS-7.1) refuses a creature that has answered and seals the caught set again.
An area's maintained state is bound to the area's occurrence, while each creature's effect is bound to its
own save occurrence. `requireTurnMaintainedStates` therefore accepts either, derived for the creature whose
turn it is.

Legendary Resistance on an area save is per creature and interstitial. After a failed Creature save
`afterTest` asks the creature's `discoverLegendaryResistance`, and `offerEncounterAreaLegendaryResistance`
seals the offer against the failed execution, the creature's facts, its d20 policy and the pinned resistance.
`decideEncounterAreaLegendaryResistance` re-checks all of them against the creature's pool as it is now
before it records `USE` or `DECLINE`; the charge is only proposed there and is spent by the area's commit.
`encounterLegendaryResistanceChoice.ts` holds the helpers shared with movement.

`settleEncounterAreaAction` runs only when every save is answered and every offer decided. It rolls damage
once through a frozen roll tape (the first creature that needs die n rolls it, later ones replay it, and a
different die is refused), then continues each creature's own plan, so resistance, immunity and
vulnerability stay per creature. The persistence side commits one root `AGGREGATE_CHOICE_COMPLETE` that
holds the source spend once and one mechanics-batch child per kept creature
(`packages/encounter-persistence/src/areaCommitPersistence.ts`); `REVERT_LAST_ACTION` reverts the children in
reverse, then the root. An outcome that leaves a condition, a lasting or recurring effect or a maintained
effect is refused whole until SPELLS-19.

Each action choice carries `target`: `{ kind: 'ACTOR' }`, `{ kind: 'POINT', area }` (the authored radius or
cube edge), `{ kind: 'DIRECTED', area }` (the authored cone length, line length and width, or the edge of a
cube that extends from the caster) or `{ kind: 'CASTER_CENTERED', area: { kind: 'RADIUS', radius } }` (a Self
sphere, cylinder or circle: no aim), built by `encounterActionChoiceTarget`. An action that places a zone (current,
D154, SPELLS-4.T1b) takes the target of its zone, from `encounterZoneChoiceTarget`: `POINT` or `CASTER_CENTERED`,
`{ kind: 'WALL', area: { maxLength, thickness } }` for an authored WALL shape (the client picks two ends; the
thickness is centered on the segment, stored as a polygon) or `{ kind: 'RING', area: { maxOuterRadius, thickness } }`
for a hollow round zone (the client picks the center and the outer radius; inner = outer − thickness). A cast-time
pick between zones is `{ kind: 'ZONE_OPTIONS', options: [{ id, label, target }] }`: the client picks an option, then
aims it as that option's target asks. `evaluateEncounterZoneTarget` refuses a target of another kind
(`UNSUPPORTED_AREA`), a wall or ring over its authored maximum (`AREA_TOO_LARGE`) and a wall of no length or a
ring no wider than its thickness (`AREA_TOO_SMALL`). A policy this path cannot resolve
(a dome, a wall that places no zone, or a cone or line whose range is not Self) stays an actor choice and is refused when resolved. The web converts the area to Scene coordinates with
`pointAreaInSceneCoordinates`, `directedAreaInSceneCoordinates` or `wallAreaBoundsInSceneCoordinates`
(`shared/vtt`), the same functions `compileEncounterPointArea`, `evaluateEncounterDirectedAreaTarget` and
`evaluateEncounterZoneTarget` use, to preview it and list the tokens the viewer sees inside; a wall or ring is
drawn by dragging from one end (or the center) to the other end (or the edge), clamped to its maximum
(`drawnAreaAim`). The room still decides who is caught.

### A list of chosen creatures (current, SPELLS-8.T12, D118)

An action whose targeting is `CHOSEN_CREATURES` with an authored `maxTargets` (Mass Healing Word, Prayer of
Healing, Mass Cure Wounds, Magic Missile, Acid Splash, Chain Lightning, Scorching Ray, Eldritch Blast), or with no cap
on a list that names each creature once (SPELLS-4.T2a3: Pass without Trace), takes the fifth target, `{ kind: 'ACTORS', actorIds, scene }`, built from
`encounterActionTargetKind` and offered as `{ kind: 'ACTORS', maxTargets?, area, allowRepeatedTargets? }` (`area` is the `RADIUS` the
spell names, or null). It is a reusable target kind, not a spell field: any chosen-creatures policy the compiler
accepts uses it. The compiler accepts one only when the outcome is a heal, unscaled dice damage, a per-creature save (an `ANY` disposition, a `SAVING_THROW` trigger and no repeated targets) or a per-ray attack (an attack trigger, repeated targets allowed, no shape), the list resolves (`chosenCreaturesCap`: a fixed cap, no cap on a list that does not repeat creatures, or a cap
scaled by the cast level or the Character's level and resolved first by `resolveChosenCreaturesTargeting`, which reads `spellCastLevel` and `characterLevel` from the descriptor; the Character's level is the sum of its class levels, set on the entry point by `buildCharacterSpellCastActions`), and the shape is absent or a sphere, cylinder or circle
whose range is a distance. A willing list also accepts a timed grant (SPELLS-4.T2a3: Pass without Trace): the room plans one
active effect per chosen creature, as it does for a link or a form. One `RESOLVE_ACTION` carries the whole list (D118: one cast, one commit, one slot
spend, one undo; one action per creature is rejected because it breaks undo atomicity).

The room (`nativeEncounterActorsRules.ts`) refuses an over-cap list, and a creature named twice unless the
targeting allows repeated targets, then rolls: a list that names each creature once shares one frozen roll tape, so
every creature gets the same heal, and `executeEncounterActorsAction` builds one occurrence per entry
(`encounterChosenActorEntries`). **Projectiles (current, SPELLS-26):** when the targeting allows repeated targets, each
entry is one projectile (Magic Missile's dart): it rolls on its own tape, resolves as its own child with its own
occurrence, lands on the hit points the creature's earlier entries left (the executor and the room chain the
binding and the prepared facts per creature), and carries its own concentration check. The slot is spent with the
caster's first entry only; the transport allows a repeated id and leaves the rule to the action. `rollsPerTarget`
travels from the room to persistence so every projectile gets a roll card. A shaped list needs `scene.point`; the room prepares the point as a point area
(`prepareAreaScene`, so range and sight warnings are the area's) and refuses a chosen creature outside the
sphere (`catchEncounterAreaActorIds`). An unshaped list takes no point. Warnings are gathered across the list
and deduplicated (`evaluateEncounterActorsRuleWarnings`); a creature in a shaped list is not range-checked
itself, because the picked point carries the range. The commit reuses the `ENCOUNTER_AREA_ACTION` root and
children with a null `area`; `encounterChosenActorsChecksum(actorIds)` is the root's caught checksum, so the
persistence side (`areaCommitPersistence.ts`) checks every id belongs to the Encounter and commits each as
perceived by the caster. **Saves (current, SPELLS-26):** a list whose plan is not `SINGLE_GRAPH` (Acid Splash,
Chain Lightning) is not executed in place: `planNativeLiveEncounterActorsAction` hands it to `sealReachSaves`, the
point area's own open path, so the list pends on one sealed save per distinct creature and resumes through the
area's Answer, Legendary Resistance, GM removal and Commit planners. Damage is rolled once for the cast and
replayed per creature on one frozen tape (`createFrozenRollTape`), so a failed and a successful save share the
dice they have in common. **Rays (current, SPELLS-26):** a list whose trigger is an attack (Scorching Ray, Eldritch Blast) goes the same way, but each entry is one ray: the roller is the caster, not the creature, and a creature that several rays are aimed at has one entry (and one sealed attack roll) per ray. Every entry has its own occurrence (`encounterChosenActorEntries`; a creature's first entry keeps `encounterAreaTargetOccurrenceId`), `EncounterAreaTarget` and `EncounterAreaTargetTest` carry it, and the pending summary lists `{ actorId: roller, targetActorId, request }`. Settling rolls each hit's damage on its own tape (`rollsPerTarget`, decided by `makesAttackRoll`) and chains a creature's hit points between its rays (`bindingAfterHitPoints`, shared with `executeEncounterActorsAction`). The GM removing a creature removes every ray aimed at it. The pending context's `superRefine` allows a repeated creature only when the caster rolls. **Corpus guarantee (SPELLS-26.1):** every SRD `CHOSEN_CREATURES` spell with a cap either compiles as a list or is refused for the reason the same effect cast at a single target is refused; the corpus test derives this from the real compiler, so it needs no list of exceptions. The pending context (`EncounterAreaActionPendingContextDto`) seals a null `scene`
and `area` for a list read against no Scene or naming no area, and a null `token` for a creature with no token
on the Scene read; `requireAreaActionPendingRoot` then checks the sealed creatures plus the GM's removals equal
the named ones, and, when the list names an area, that each is still inside it (a point area instead requires
the caught set to equal the sealed one). An immediate list (heals, projectiles) still commits whole in the
room; `executeEncounterActorsAction` refuses an outcome that asks for evidence. A spell that takes a list is refused when sent at one creature
(`TARGET_UNAVAILABLE`).

### Passive effect on reaching 0 hit points (current, SPELLS-33.T6e1)

An authored Effect with invocation `{ kind: PASSIVE, triggerCode: HP_ZERO }` and a saving throw is a creature
trait that fires when the holder is defeated (Balor Death Throes). Discovery normalizes it to a
`SAVING_THROW` area action but lists it in `passiveHpZeroEffects`, never in `available`, so it is not an
ordinary action. After a command commits, `raiseRoomHpZeroEffects` (`roomEncounterHpZeroTriggers.ts`, called
once at the room's `executeRoomEncounterCommand` funnel, not per root) diffs the newly defeated creatures and
raises each holder's effect as a `CASTER_CENTERED` area through the SYSTEM admission described in
[persistence](persistence.md). Auto-roll victims settle in the commit that raised it; a manual roller gets an
`AREA_PENDING` in that commit. The burst is centred on the defeated token's footprint and catches every
actor in range, allies included, except the holder. It never recurses: the burst's own defeats raise nothing
(deferred edge case in the SPELLS-33 workbook).

### Passive effect at the start of the holder's turn (current, SPELLS-33.T4i1a)

An authored Effect with invocation `{ kind: PASSIVE, triggerCode: START_OF_TURN }` is a creature trait that
heals its holder as its turn begins (Oni and Shield Guardian Regeneration: a `HEAL` outcome behind a
`TARGET_HIT_POINTS_AT_LEAST` result-block gate). Discovery lists it in `passiveStartOfTurnEffects`, never in
`available`, and refuses any outcome but `HEAL` as unavailable with a clear reason. The gate compiles to the
same hit-point band as `TARGET_HIT_POINTS_AT_MOST` (`hitPointGateBand`), so a gated heal is a version 2
`dnd5e.heal-proposal` operation. After a START or ADVANCE_TURN commits, `raiseRoomStartOfTurnEffects`
(`roomEncounterStartOfTurnTriggers.ts`) raises each effect of the creature whose turn began as a self-targeted
`ACTOR` root (`systemTrigger.trigger: START_OF_TURN`), admitted by the SYSTEM admission when the parent is the
turn command and the holder still has the turn. A player-submitted `RESOLVE_ACTION` that names the trait is refused,
so it is never a free heal. Sunlight and running water are deferred edge cases.

**Damage taken since the turn began (current, SPELLS-33.T4i1b1).** A creature or custom actor carries an optional
`damageTypesSinceTurnStart: {damageTypeId, commandId}[]`. `withDamageTypesTaken`
(`encounterDamageTypesSinceTurnStart.ts`) is the only place it grows: `planEncounterMechanicsBatch` calls it for
every DAMAGE application with a resolved amount above 0, and every mechanics write (actions, areas, movement, turn
and zone effects) lands through that plan. The record is keyed by the root `sourceCommandId`, so an action's undo
removes exactly what it dealt (`revertDamageTypesTaken`). A START_OF_TURN root reads the record, then
`clearHolderDamageTypes` empties it in the same commit and stores the cleared entries on the root's
`clearedDamageTypes`, so damage dealt during the holder's own turn suppresses only the next trigger. The
suppression gate that reads the record is described below (T4i1b2). A rule-raised START_OF_TURN root is not
separately undoable today (its parent is the turn command), so the stored `clearedDamageTypes` is restored only once
turn undo reverses it; turn commit and turn undo are unchanged.

**Gate kinds and damage-type suppression (current, SPELLS-33.T4i1b2).** `systems/dnd5e/effectActionGates.ts` holds the one
gate-kind table (`DND5E_GATE_KINDS`: `HIT_POINT_BAND`, `DAMAGE_TYPE_SUPPRESSION`). Each kind owns its operation inputs, its
node inputs, `admits(inputs)` and `evidenceAdmits(evidence)`; a gated proposal (`contractVersion` 2) always carries every
kind's inputs, an unauthored gate is wide open, and authorization is the conjunction of the table, so a new gate kind is
one table entry. A result block authors the suppression as `suppressedByDamageTypeIds` beside `gate`. The prepare path
binds the holder's `damageTypesSinceTurnStart` as the `dnd5e.target-damage-types-taken` fact (bound only for graphs that
carry the input, so ungated checksums do not move), the evidence check requires the fact to match the node binding and
`authorized` to equal the conjunction, and a replay re-derives it. Vampire and Vampire Spawn (suppressed by radiant,
which also covers holy water) and Troll (acid, fire; heals at 0 hit points) author Regeneration this way, and
`CREATURE_VAMPIRE_REGENERATION` is deleted. Sunlight and running water stay deferred edge cases.

**Reduced-to-0 gate (current, SPELLS-33.T4i3a).** `REDUCED_TO_ZERO_BY { damageOutcomeId }` is the third gate kind: a KILL,
CONDITION or fixed HEAL outcome follows only if the named damage outcome of the same path took the target from above 0 to 0
hit points. It is a gate-table entry, not a rung of the `hitPointBand` ladder (ADR 0039). The compiler resolves
`damageOutcomeId` by `entryId` to the earlier damage group's node id and binds it as the literal `reducedToZeroByNodeId`
(`''` when unauthored, so the other kinds stay wide open). The graph cannot see damage defenses, so it admits;
`interpretDirect` holds the proposal back unless a traced DAMAGE application from that node has `beforeCurrentHitPoints > 0`
and `afterCurrentHitPoints === 0` (`reducedToZeroGateHolds`), so resistance that leaves the target standing withholds it.
Gate evidence is checked against the hit points the graph's facts were taken at (`startingHitPoints`), not those left by
earlier applications. A gate naming no earlier damage group of the path is refused at compile time. Adding the input
changed every gated v2 graph's checksum once.

### Creature feature attack roll modes near an enemy (current, SPELLS-33.T6d3a, D165)

A Creature's feature `ATTACK_ROLL` advantage or disadvantage grant (`conditionalAttackAdvantageGrants`, Pack Tactics and Assassinate) reaches
its own attack rolls through `creatureFeatureAttackContributors`, merged beside the active-effect contributors in
`prepareEncounterActionMechanics`. The grant's `ENEMY_NEAR_TARGET { feet }` restriction (an EQUIPMENT context, as a
rider's) folds to a deferred `ENEMY_NEAR_TARGET` condition (`max` is the distance); a Character's item checks still
fail it closed. `featureModifiersReadEnemyProximity` makes the preparation load the Scene's enemy proximity for a
grant that reads it, so the contributor holds only with a Scene and an able enemy of the target within the distance.
"Enemy of the target" is the disposition-based set a rider uses, which equals "an ally of the attacker" when the
attacker is hostile to the target. Disarm attacks do not read these grants yet.

**Target has not taken a turn (SPELLS-33.T6d3b, D165).** Assassinate authors the same grant with
`TARGET_HAS_NOT_TAKEN_TURN` (no parameters) in place of `ENEMY_NEAR_TARGET`; it folds to a deferred
`TARGET_HAS_NOT_TAKEN_TURN` condition. `featureModifiersReadTargetTurn` makes the preparation call the optional
`loadTargetHasNotTakenTurn` supplier, which the session worker backs with `readNativeLiveHasNotTakenTurn` (the
`INITIATIVE_ROUND` capture; no stored state): the target is a participant still `READY` in round 1. The same
supplier serves opportunity attacks. Limitation: a Creature reinforced into a later round never reads as having
yet to take a turn, and the attacker's own first-turn clause is not gated. The automatic critical hit against a
surprised Creature and the Bugbear's Surprise Attack stay description-only (the engine has no surprise step).

### Caster-centered radius areas (current, SPELLS-22)

An `AREA_CONTENTS` action whose range is Self and whose shape is a sphere, cylinder or circle takes the fourth
target, `{ kind: 'CASTER_CENTERED', sceneId, expectedSceneVersion }`: it names no origin or direction. The
origin is the caster's own token (`evaluateEncounterCasterCenteredAreaTarget` returns the `RADIUS` shape; the room
reads the caster's token with the Scene and seals its position), and the sealed area is the same `RADIUS` shape a point area seals, so no persisted shape changes;
the caster-centered meaning lives in the persisted command's target kind. "Within N feet of you" is measured
from the edge of the caster's space (D114): `spatialTokensWithinSpaceRadius` catches a token whose footprint
shares positive area with the caster's footprint grown by the radius (a rounded rectangle, so a Large or
Huge caster reaches farther than a Medium one), by the same strict overlap rule as every area (D103), and never
catches the caster. `catchEncounterAreaActorIds` takes `fromCasterSpace` for it; the room and
`requireAreaActionPendingRoot` both set it from `command.target.kind`, and the latter also checks the sealed
origin is still the caster's token. The authored targeting has no "includes the caster" option, so the caster
is always excluded. Everything after the catch is the point-area pipeline; an outcome that leaves a condition or
lasting effect is refused whole until SPELLS-19, and a moving aura is SPELLS-20.

### Directed areas: cone, line and caster-origin cube (current, SPELLS-13)

An `AREA_CONTENTS` action whose range is Self and whose shape is a cone, line or cube takes the third target,
`{ kind: 'DIRECTED', origin, toward, sceneId, expectedSceneVersion }`. The origin must lie on the caster's token
footprint (`isDirectedAreaOriginOnToken`) and `toward` is the point the area is aimed at. `encounterAreaTargetKind`
is the one range × shape table (point, directed, caster-centered or unsupported) that the compiler, the choice target and the
evaluators share; a target of the wrong kind is `TARGET_UNAVAILABLE` (a direction for a point action, a point for a
directed action and anything else for a caster-centered one each say what the action takes), as is an origin off the
footprint, and each refusal has its own message (`UNSUPPORTED_AREA`, `ORIGIN_OFF_CASTER`). The caster's token is
read with the Scene, so the evaluators take it as given; a Scene without it makes the read throw
`Action Scene token context is stale.`, which the room answers as a generic `UNAVAILABLE` (not a
`TARGET_UNAVAILABLE` refusal).
`evaluateEncounterDirectedAreaTarget` returns the Scene-unit shape, and everything after it is the point-area
pipeline above: the same `ENCOUNTER_AREA_ACTION` occurrence, sealed saves, frozen damage, GM removal, commit and
undo. The pending guard (`requireAreaActionPendingRoot`) checks the sealed origin and direction against the command.
Catching (`spatialTokensInsideArea`, for every area) is strict positive-area overlap, so a creature the area
only touches along an edge or at a corner is not caught (D103, user ruling 2026-10-14). Lasting and moving zones use the same rule through the same predicate (`footprintOverlapsSpatialGeometry`): entry, start-of-turn effects (`encounterTurnEffectPerception`) and movement-reaction perception (`encounterMovementReactionPerception`) see a zone only when the footprint shares area with it, so touching its edge or a corner never catches (SPELLS-24); a directed shape needs the
caster's token among the Scene's tokens, which it excludes (it throws without it: the Scene read has already failed without the caster's token, so a missing caster here is an invariant failure). A cone is the triangle from the origin to a
far edge as wide as it is long; a line is a rectangle, 5 ft wide unless authored (a scaled or non-positive
authored width is refused at compile). A Self cube follows the 5e rule that its origin lies on a face of the
cube (`cubeFromSideOutline`; for a caster whose side is off the grid lines the picked place may not contain the pressed
point, a deferred edge case): the side faced is the dominant axis of `toward`, the face is flush against
that side and slides along it, snapped to the Scene's grid lines, according to where the origin lies along the
side, so a corner origin catches exactly the cube's squares (9 for a 15 ft cube). The places are the grid lines
whose cube shares positive length with the caster's side, and each place owns an equal share of the side, wherever
the caster stands on or off the grid. The sealed shape carries `cellSize` and `gridOrigin` (the Scene grid's origin;
a gridless Scene snaps to 5 ft squares from the Scene origin) for that snap. Token rotation is ignored: the footprint is axis-aligned. The stage aims the area with one
`VttAreaAim { origin, toward }` (`vttSceneRenderer.model.ts`): the player presses on their token's edge
(`nearestFootprintEdgePoint`) and drags the direction (the press, drag, release and cancel are
`createVttAreaAimGesture`, `vttAreaAimGesture.ts`, which the renderer's pointer handlers call), and the outline drawn is `directedAreaOutline` (a point cube
uses `pointCubeOutline`), the same geometry the room catches with.

**Placed zones (SPELLS-17, current).** An authored `MANIFEST` `ZONE` `PLACED_SPACE` outcome is a point-area action
that leaves a zone behind instead of catching creatures. The System compiler (`zonePlacementPlan`) turns the
outcome into a `zonePlacement` on the v4 `CHARACTER_ACTION` compiled entry: label, shape, trigger modes, the entry
graph (the authored save, `ON_SAVE_FAIL` damage and, when authored, a `STOP_CURRENT_MOVEMENT` that surfaces as the
graph's `movementInterruption` output; a made save may deal the same dice halved, as a second gated dice set (`damage-success-*`) behind a 0.5 multiplier, and a PER_LEVEL `SPELL_CAST_LEVEL` damage row is picked by the action's own cast level, so each slot level freezes its own graph) and an optional lingering modifier-grant template (its modifiers, senses and
`endOnEvents`). Only point shapes (`SPHERE`, `CYLINDER`, `CIRCLE`, a cube) compile; a directed zone (cone, line, a
Self cube) and any authored feature the System cannot honor in full (a second component, behavior or outcome, an
unmodeled field, a save DC other than fixed, an end event the System never reads) stay manual with
`NOT_NORMALIZED`. The component's `interactionKinds` (a non-empty list; there is no single-kind field) pick what catches a
creature (`zoneTriggers`): `ENTER_SPACE` is ENTER (the path ends inside), `MOVE_ACROSS` is CROSS, and
`ENTER_OR_PASS_THROUGH` is both (`triggerModes`); `START_TURN_IN_SPACE` and `END_TURN_IN_SPACE` are the
placement's `turnTriggers` `START_OF_TURN` and `END_OF_TURN`, and `START_OF_SOURCE_TURN` (D144) is the
`START_OF_SOURCE_TURN` turn trigger, in that order (`SPATIAL_TURN_TRIGGERS`). A zone may have either set or both;
a kind the System does not model keeps the whole zone manual. A zone outcome may have no save (D144, SPELLS-20
T6a): a behavior whose invocation is not `SAVING_THROW` and whose entries are `ON_USE` damage compiles, through
`unsavedZonePlacementPlan`, to one unmodified damage dice row dealt in full: a frozen graph of plain
`evidence.integer-range` dice and a `proposal-on_use` node, no d20 or `test` node, no adapter facts and no pinned
DC. It may act at turn boundaries and, since D154 (SPELLS-4.T1b), on a movement trigger; a halved or modified
roll, a stop or any other outcome is refused. Both the turn and the movement paths answer dice with no d20 policy:
`isDamageDieRequest` accepts a plain integer range, the executor resumes a damage die with `d20: null` when the
effect has no policy, `awaitsSpatialDamageDice` routes those dice to the zone's source as roller, and a paused
movement contact with no policy is summarized as `ACTION_OUTCOME_EVIDENCE`.
The turn stage (`selectTurnZoneContacts`) gathers contacts over every bound token: the boundary creature's own
zones at its boundary, and, at the start of its turn, each other creature standing in a zone it is the source of
that acts at `START_OF_SOURCE_TURN`. Contacts run in canonical zone turn order (`followsInZoneTurnOrder`: target
actor id, then effect id), each creature gets its own execution through the existing candidate, execution and
persistence path, and the stored zone phase holds one chained mechanics batch per caught creature (at most
`MAX_ENCOUNTER_ACTORS` transitions). `persistEncounterTurnZoneEffects` reads the Scene's token bindings through
`readEncounterActorTokenBindings` (the `ACTOR_TOKEN_BINDINGS` capture on the Worker) and settles caught creatures
in the order a spatial prefix does (`orderSpatialSettlementActors`: Characters by source id, then creatures by id). `collectSpatialTurnCandidates` (shared/vtt) is the
containment seam for turn triggers: it applies `spatialEffectAffects` and the per-turn limit, as movement does.
A Creature's passive zone (D144, SPELLS-20 T6b) is a PASSIVE feature Effect manifesting one zone that acts at its
source's turn; discovery returns it in `passiveZones`, never as an action. `planEncounterPassiveZones` plans one
TOKEN-anchored zone per such feature of each Creature bound to a token, with no maintained state and an id fixed by
the Encounter, actor and feature Effect. One persistence helper, `placeEncounterPassiveZones`, creates them: at the
START terminal before the incoming zone phase, and at a GM token bind in a PREPARED or ACTIVE Run (D147); the room's
turn preparation plans the same START records (`plannedSpatialEffectRecord`). Removing the Creature, or unbinding or
rebinding its token, deletes them first. While the source is defeated its passive zones stay stored and drawn but are
`suppressed`: `toSpatialInstances(effects, actors)` derives the flag from the Run's defeated actors for every
candidate seam (turn contacts, movement and forced movement), so a revived source has them again without a new
placement. The SRD Balor's Fire Aura (T6c) is the first SRD passive zone.
A Creature's passive damage trigger (SPELLS-33 T6e3a) is a PASSIVE feature Effect with `triggerCode: INCOMING_DAMAGE` and a non-empty
`damageTypeIds`, whose single FIXED outcome is a timed self `APPLY_GRANT` (roll-mode or speed modifiers, `turnAnchor` the holder's end of
turn). It is derived, not stored: `discoverEncounterFeatureActions` returns it as `passiveDamageGrants` (compiled by the System adapter's
`passiveDamageGrantPlan`), `prepareNativeIncomingDamageGrantTriggers` makes the effect each would create, and `targetEndedEffects` returns
`{endedEffects, releases, grants}` for the damage dealt: ended effects release first, then grants are created, and a held grant from the same
source feature (`authoredEffectId`) is ended in the same call, so a repeat hit replaces the expiry. The action root writes the grants through
the settlement and the receipt's `grantEffectTransitions`; persistence checks their origin is the holder, and undo deletes them. Creature
holders only. The turn-zone, melee-retaliation, legendary and movement-reaction roots call the same seam (T6e3b): melee retaliation records
the grants as `grantEffectTransitions` and the conditions the ended effects released as `releasedConditionIds` on its evidence (persistence
refuses a settlement whose created grants differ; it returns the ended effects, which the action root keeps in `consumedGrants`, so undo deletes
the new grants, then restores the ended and replaced effects and their released conditions), and
the movement-reaction root records them as `grantEffectTransitions` beside `ended`. Each area target's outcome calls it and creates the grants beside its other effects (`grantEffectTransitions` on its batch; the area root
keeps the ended effects in `consumedGrants`). Spatial movement contacts (opt-in via
`damageEnds.incomingDamageGrants`, unset for contacts) do not yet call it; contacts wait with T6e4's gap.
A zone component may lend its occupants `occupantSaveBonus` (D155, SPELLS-20 T5a) instead of a behavior: every saving throw, the
source and its allies, a fixed amount or a source ability modifier with a minimum. It compiles only on an untriggered SOURCE
zone with no other component rule, whose entry is a lasting one-node graph; a radius may scale by class level. A source
ability-modifier amount or a class-level radius compiles only on a PASSIVE zone, since only placement on a known source
resolves them; a FIXED bonus may also ride a cast zone. Placement pins both (T5b): `planEncounterPlacedZone` takes a
`PlacedZoneSource` (ability modifiers and class levels) and records the resolved integer amount, and the caller sizes the
area from `zoneShapeAtSource`. A Character's PASSIVE feature zones (D155) are discovered from `passiveZoneSources`, the
server-only candidates and entry points `buildCharacterActionRuleFacts` sets aside instead of offering them as actions,
and placed by the same `planEncounterPassiveZones`, which takes each Character's current rule evaluation
(`characterRules`) and resolves the zone against its ability modifiers and class levels; a Creature resolves against its
snapshot ability scores. `placeEncounterPassiveZones` reads those rules through the host's `readCharacterRules`, as the
Campaign owner reads them; a Character whose rules are unavailable keeps no zones.
At save time (T5c) `encounterOccupantSaveAuras` finds the auras holding an actor (its token footprint shares area with
the zone, the source is the actor or its ally, a defeated Creature source is suppressed); the Worker reads them through
the internal `OCCUPANT_SAVE_AURAS` turn capture, and `withEncounterOccupantSaveBonus`, applied after
`withEncounterHolderDefense` in the one save-target preparation, skips a Character source that is unconscious and adds
the largest amount to every save row's modifier, so the bound save fact records it. The target records the amount
(`occupantSaveBonus`) and `rebuildEncounterTurnTarget` reapplies it, because turn stages rebuild caught targets from raw facts.
`MELEE_HIT_ON_SOURCE` (D153, SPELLS-20 T6d1) compiles to `retaliatesMeleeHits: true` on a SOURCE zone (refused on any
other attachment) and adds no movement or turn trigger. A placement may also carry `sourceGrant`, the one APPLY_GRANT
authored beside the zone manifest, compiled through `modifierGrantEntryPlan` as a timed grant counted on the
active-effect clock, independent of the zone's lifetime. Both are persisted (T6d2a): the area commit creates the
grant on the placer as `zoneSourceGrant`, recorded as the area root's `sourceGrantTransition`, and undo deletes it
before the zone. A melee hit (`isInstalledMeleeAttackTrigger` with a range) on a creature whose own retaliating zone
contains the attacker runs `selectMeleeRetaliationContacts` and `planEncounterMeleeRetaliation`: each zone executes
against the attacker with system-rolled dice, as one attacker mechanics batch carried on the action receipt's
`meleeRetaliation`, which persistence re-derives from the locked Scene and refuses when stale. Opportunity attacks
(T6d2b) run the same step in `planReaction` with the mover at the reaction's contact, carried on the reaction
application; Legendary Action attacks run it through `prepareTurnLegendaryActions`' `meleeRetaliation` port, carried
on the window's application. Both replay from that evidence (`retained`), so a staged response or a later window's
re-run rolls no fresh die.
A creature's passive melee trait with no zone (Remorhaz Heated Body, SPELLS-33 T4k2) is the same zone derived from the
trait: a PASSIVE effect whose melee attack trigger and distance range say how near a hitter must stand, with direct
dice damage on `ON_USE`. `passiveMeleeRetaliationZone` (given the System's attack kind) stands for it as a SOURCE sphere of that range with one
`MELEE_HIT_ON_SOURCE` component whose behavior is the trait's own effect, so discovery, placement on the token, the
selection, the system-rolled plan, persistence and the damage-ends seam are the zone path above. Placement centers every
passive zone on its holder whatever range its trait authors. A hit by touch is not modeled.
A component that authors `requiresFullyWithin` (Stinking Cloud, SPELLS-20 T4b3a) is compiled onto the placement and
instance, and the turn seam then catches only a creature whose whole footprint lies inside the area (edges may touch
its boundary); the compiler refuses it on a zone with a movement trigger. A component's
`automaticSaveSuccessImmunityDamageTypeId` (D141: one optional authored damage type id, any type) pins that
damage type as an adapter fact on the zone entry; when the target holds an IMMUNITY defense to it, the dnd5e binder sets
the `SAVE_AUTO_SUCCESS` outcome rule (the mirror of D94's `SAVE_AUTO_FAIL`), so the made-save path runs whatever the
roll. A "does not breathe" rider has no creature fact and stays unauthored (a deferred edge case).
A zone's failed save is one composable outcome set (D142, SPELLS-20 T4b3b), not a list of shapes: damage rows, at
most one `STOP_CURRENT_MOVEMENT`, at most one `APPLY_GRANT`, at most one System-vocabulary `CONDITION` and at most
one `LOSE_ACTION`, with at least one outcome; a made save still only deals damage. The set holds one graph outcome
(damage or the condition) beside the stop, grant and lost Action, so damage plus a condition stays manual until
SPELLS-4.T1e. With no graph outcome the entry binds the save's `test` node, and the executor accepts the empty
applications of a path that has no proposal node. A `LOSE_ACTION` (D141) compiles only on a zone acting solely at
the start of a turn and sets `failedSaveLosesAction` on the compiled and stored placement. The turn stage
(`prepareEncounterTurnZoneEffects`, which now takes the reusable `definitions`) then evaluates the target's Action
through `evaluateEncounterActionEconomy` after the start-of-turn refresh and, when it is unspent, consumes it with
`consumeEncounterActionEconomy`; the spatial turn execution carries `actionEconomy` (the transition, or null when
the Action was already spent, a second zone at the same boundary included). `persistEncounterTurnZoneEffects`
refuses a transition on a zone that does not cost the Action or on a path other than `ON_SAVE_FAIL`, and settles it
through `consumeNativeActionEconomy`, which checks the stored actor's checksum.
The turn stage that runs them lands with SPELLS-20 T4b2b. SRD text
that says a creature "enters the area" (Caltrops, Ball Bearings) authors `ENTER_OR_PASS_THROUGH`, so a drag that
ends beyond the field still triggers the save and, on a failure, stops at the first field square it entered. The System, not the authored zone, owns the placement defaults: `planEncounterPlacedZone` sets
`movementKinds` to voluntary, forced and teleport movement, `activation` to `REPEATABLE` and `visibility` to
`PUBLIC`. The compiled zone stores only the grant contribution the planner reads: the zone row's own
`recurrence.endOnEvents` stays empty, and the creature's grant takes its end events from the grant template. The
action opens no area occurrence (`placesZone` on the pending root): it commits the spend and a
`liveSessionPlacedSpatialEffect` per zone component (see the bands below) in the same transaction as every other
area commit. The zone is
built by `planEncounterPlacedZone` (FIXED, `SCENE_ABSOLUTE`, a cube as a polygon via `pointCubeOutline`), stored
through `createPlacedSpatialEffect` (refused with `TARGET_UNAVAILABLE` at `MAX_SPATIAL_RULE_EFFECTS_PER_SCENE`), named
on the area root in `placedSpatialEffectIds`, and deleted by GM undo (`actionRevert.ts`) like a D99 grant. A concentration
zone compiles `zonePlacement.maintenance` (the same policy shape as `activeEffectPlan.maintenance`);
`prepareEncounterActionMaintenance` selects it, so a zone-only cast opens Concentration and the zone depends on that
state (`maintainedEffectStateId`, D135). When a
creature fails the zone's entry save, `persistLiveMovementSpatial` copies the zone's grant template under the
movement's origin onto that creature (`planSpatialEntryGrant`, built from the grant entry; it does not stack per
authored zone entry). The grant's frozen graph is provenance only (`actionEffectPersistence.ts`,
`encounterActionEffectReceipts.ts` read its source identity and checksums), so it reuses the zone's. A grant
whose `recurrence.endOnEvents` names `ON_HIT_POINTS_REGAINED` ends in `persistEncounterMechanicsBatchPlan` when any
application heals at least 1 hit point (a `HIT_POINTS_REGAINED` event, see "Event hooks"). An effect whose `recurrence.endOnEvents` names `ON_LONG_REST` (Contact Other Plane, SPELLS-4 T2a1b) ends when its Character holder finishes a long rest (`activeEffectEndsOnRest`); the Sheet's `COMPLETE_REST` deletes it and releases the conditions only it held (`settleCharacterEndedEffects`). A timed condition whose duration is `UNTIL_DISPELLED` (Sequester, SPELLS-4 T2a4) counts no turns and lasts until the GM ends it or an authored end trigger does. A zone whose component authors `choosesUnaffected` (Spirit Guardians, SPELLS-20 T4c) lets the caster designate creatures at cast: the choice
DTO advertises `choosesUnaffected` on its zone target (`POINT`, `CASTER_CENTERED`, `WALL`, `RING` or `ZONE_OPTIONS`), the cast command carries optional
`unaffectedActorIds` on the zone's target (the Worker refuses it for an action whose zone does not offer it, or for an id
that is not an Encounter actor), `planEncounterPlacedZone` stores it on the placement, and `collectSpatialMovementCandidates`
never catches a listed creature. An ON_USE `CHOICE` path whose every option places one zone (Spirit Guardians'
radiant or necrotic damage, SPELLS-20 T4e, D140) compiles to a cast-time pick, `compilation.zonePlacement =
{ options: [{ optionId, label, zone }] }`, each option freezing its own zone graph; the options must share
attachment, spared-creature choice, Concentration and any save at the caster's DC, or the action goes manual
(`zoneChoicePlan`); each may have its own area (D154: Wall of Fire's straight wall or ring). The action's facts
read that shared save from every option (`zoneEntrySavingThrow`). The choice DTO lists them as a `ZONE_OPTIONS`
target, each option with its own target; the cast command names one as `choiceOptionId` on the target it aims, and
the Worker places that option's zone (`chosenZonePlacement`), refusing a missing or unknown pick and a target kind
the picked option does not take (`prepareCasterSource`); later triggers run the stored definition. A zone with no
save (Wall of Fire) authors a PASSIVE `ACTIVATED` behavior whose ON_USE path deals the damage, so its trigger rolls
the dice with no d20; the caster's controller rolls them. A `CHOICE` path whose options place no zone (Protection from
Energy's damage type, Blindness/Deafness's condition, SPELLS-30, D148) compiles to `compilation.choice =
{ options: [{ optionId, label, activeEffectPlan, executionPlan }] }`, exclusive with `zonePlacement`. Both pickers
narrow the action to one option with `castChoiceOptions`, which restores each option's own result kind from the
compiled entry's `optionGroupKind`. The options must share their test and maintenance graphs, or the action goes
manual. The top-level plans hold the first option. The choice DTO lists the options as `choiceOptions` on the
`ACTOR` / `ACTORS` target, and the cast command names one as `choiceOptionId`; an action whose target is any other
kind cannot carry the pick and goes manual. A read that shows only the shared test before any pick (the target
modifiers) passes `readsSharedTest` and reads the top-level option.
Creature feature actions compile the same way: discovery calls `compileCastChoicePlans` for any compiled effect with
`castChoiceOptions` (Vampire Spawn Claws and the Vampire's Unarmed Strike are damage-or-grapple picks, SPELLS-33 T3a6),
and a failing option makes only that action unavailable (D54). A flow that cannot prompt (opportunity attacks, reactions,
Legendary actions, turn flows) prepares with `firstOptionByDefault`: the first authored option is the no-prompt default.
`prepareEncounterActionSource` is the one place the picked option's plans replace the top-level ones. It refuses
a missing or unknown pick (`CastChoiceUnavailableError`, `TARGET_UNAVAILABLE`) before any roll. A zone whose component authors `maxApplicationsPerTurn` (Spirit Guardians "first time on a turn", SPELLS-20 T4b1) is compiled onto the placement and instance, and `collectSpatialMovementCandidates` drops a candidate whose `effectId:actorId` entry in the run's `zoneApplications` already holds the limit for the current `turnSequence`; the terminal movement publications record the settled executions with `recordZoneApplications` (see persistence.md). A zone whose component authors `bypassAtHalfSpeed`
(SRD "through the area at half speed") can be crossed carefully (decision Q2): the voluntary `MOVE_SCENE_TOKEN`
command carries an optional `carefully` flag, the movement cost doubles for the path's footprint share inside that
zone, and the flag reaches candidate evaluation so that
zone's save is skipped (`collectSpatialMovementCandidates`; forced and teleport movement ignore it). Both the
bypass and the doubled cost apply only to zones the mover can see (`isVisibleHalfSpeedField`: `PUBLIC`, or
`spatialState.revealed`), so a hidden zone triggers whatever `carefully` says. The tabletop
learns which fields offer the choice from `halfSpeedFields` on the Encounter session state (visible, scene-absolute
placements only through the same predicate, read once by `readHalfSpeedFields` for both the Convex read and the room push); the stage's drag
preview offers "Move carefully" and "Move normally" before sending. A zone's authored `movementCostMultiplier`
(D154: more than 1, up to 100) and `blockingRules` (including the new `BLOCKS_SIGHT`) compile onto the placement.
A zone's own component may author `perDistanceMoved` (D156, SPELLS-4.T1h): placement resolves it to the
placement's `distanceStep` in Scene distance units, and `collectSpatialMovementCandidates` raises one `ENTER` candidate
per whole step the footprint travels inside, measured by the Scene grid and carrying its `step` ordinal, so the loop runs
the frozen entry once per step. A finished spatial execution that drops a voluntary mover to 0 Hit Points stops the move
at its contact (`spatialExecutionStopsMovement`).
The multiplier slows only a mover the zone catches (SPELLS-20 T4d, refining D154's "every mover"): `zoneMovementSegmentMultiplier` (shared/vtt) skips a mover that `spatialEffectAffects` spares (designated unaffected, or a defeated Creature's suppressed passive zone) and the token a `TOKEN` zone is anchored to, so Spirit Guardians never slows its caster while a wall the caster placed does. The room's movement charge (`encounterMovementPublication`) and the tabletop's drag-route label (`formatSceneRoute`) both price a walk through it, the label from `movementCostZones` on the Encounter session state (`readSessionMovementCostZones`: visible zones, token zones only when the viewer's projection lists the source, designations filtered to listed actors). A zone whose only component prices movement (Entangle's difficult terrain, D156) compiles from its appear save (`zonePlacementPlan`).
A zone may author more than one component (D154 amendment): the first covers the zone's shape, and each later one
authors `region: { kind: 'SIDE_BAND', distance }` and compiles to `zonePlacement.regionComponents` (at most one
today), each with its own label, triggers and frozen entry, sharing the zone's Concentration and never sparing
designated creatures. A band is only beside a `WALL` or `RING`: its target offers `sideBand`, the command must name
`side` (`LEFT`/`RIGHT` of travel from `from` to `to`, or `INSIDE`/`OUTSIDE` a ring) and a command for a zone with
no band must not (`evaluateEncounterZoneTarget`: `SIDE_REQUIRED`, `SIDE_NOT_OFFERED`). The Worker places the
band as its own FIXED record (`planEncounterZoneBands`, geometry from `wallSideBandGeometry`: the wall plus the
distance on that side), so every record a cast places is named on its root, removed by undo and ended with its
Concentration together.
A zone-placing cast may also author an ON_USE `SAVING_THROW` behavior beside the zone manifest (D154 amendment,
SPELLS-4.T1g): the save each creature in the area makes once as the zone appears. The entry-point compiler runs it
as the cast's `TEST_OUTCOME` plan against the zone's aimed area (the wall or ring itself, never its band; its compiler
source carries `zoneAppearSave`, the only test whose area may be a `WALL`), and the
Worker catches the area's creatures as for any area save, so answers, D100 perception, GM removal, Legendary
Resistance, settlement and undo are the area occurrence's own (`prepareCasterSource` sets `appearSave`; the pending
snapshot's `zoneAppearSave` keeps the catch on refresh). A zone with no component is placed with no triggers, one no
creature interacts with (Wind Wall). Its appear save may hold its failed condition (`heldBySource`, Entangle): the
zone carries the `heldCondition`, the cast's own timed condition plan is dropped, and `prepareNativeActionEffectsPlan`
plans the hold (`planSpatialHeldCondition`) under the zone's Concentration; a zone with components cannot, and an
appear save that holds its condition may contribute nothing else.
A component's `requiredSight` (`OCCUPANT_SEES_SOURCE`, `SOURCE_SEES_OCCUPANT`; SPELLS-33.T6e, Chain Devil Unnerving Mask)
gates a save-bearing turn trigger on mutual sight: the Worker's turn preparation reads live perception through
`loadSourceSight` and `prepareEncounterTurnZoneEffects` injects `zoneSightRequirementMet` into the contact's derived facts, and
the compiled save evaluator treats a false value as an unrolled success. Convex persistence trusts the planned executions.
Damage a turn zone or a melee retaliation deals ends the target's effects that end on damage (SPELLS-33.T6e4): the planner
passes `damageEnds` to `planNativeSpatialMovementPrefix`, and both it and persistence call `spatialDamageEnds` over the same
held effects. The releases (`CONDITION_REMOVE`, `TEMPORARY_HIT_POINTS_RELEASE`) append to the target's one mechanics batch after
the zones' applications, persistence checks them against `targetStateAfterEndedEffects` and deletes the ended effects with
`deleteGrants`. Occupant save auras lend bonuses and deal no damage; spatial movement contacts do not pass `damageEnds` yet.
A zone condition the zone does not hold may author `turnAnchor { TARGET, END_OF_TURN }` with a one-turn duration: it compiles to
`heldCondition.endsAtEndOfHolderTurn`, and `planSpatialHeldCondition` plans a one-tick effect the holder's own turn-end
decrement ends, independent of the zone's lifetime. `recordsSource` names the zone's source on the condition.
The multiplier applies to every mover for the footprint share of the walk inside the zone: `preparedMovementCost`
gives `measureScenePathMovementCost` a segment multiplier (`spatialSegmentMovementMultiplier`), so each stretch of
a segment costs the highest of the terrain multiplier, the multipliers of the zones the footprint is inside, and
careful doubling, with no stacking. Blocking rules are only projected: cover from them belongs to SPELLS-14, and
zones blocking vision is a future enhancement. Every path that raises a holder's hit points ends its
`ON_HIT_POINTS_REGAINED` grants through one helper, `endGrantsOnHitPointsRegained` (`consumedGrantPersistence.ts`): the
Encounter mechanics batch (a heal, or a death save's natural 20, keyed on the target's hit points rising),
a Character's Sheet command that raises hit points (Convex `executeCharacterSheetCommand` and the room's Sheet command path), and
a GM `UPDATE_ACTOR` edit that raises a creature's hit points. A batch run by an action or area command hands the ended
records to the root's `consumedGrants` receipt, so GM undo restores them with the same id and version; the Sheet, death
save and GM edit paths have no undoable root, so their endings are not undone. The other mechanics-batch callers need no
receipt: basic action check settlement applies only `STABILIZE` and Cleaving only `DAMAGE`, neither of which raises hit points,
and movement reactions and spatial effects run under `MOVE_SCENE_TOKEN`, which is not an undoable root: `REVERT_LAST_ACTION` refuses it, and the Scene undo (`UNDO_LAST_SCENE_MOVE`) refuses a move that recorded rule receipts, because it restores only the token's position. Not yet: hidden or unnoticed zones (MOVE-3.3 to 3.5).

A result that tiers on the target's hit points (`HIT_POINT_TIERS` path rows, T2i4a) compiles to
`compilation.hitPointTierPlans`: one active-effect plan per tier, each carrying `hitPointTier: { atMost }`, with
`activeEffectPlan` null. `hitPointTiers.ts` is the one place a ceiling is compared with current hit points (the
lowest `atMost` the target satisfies wins, none means no tier); `encounterActiveEffectPlan` picks the target's plan
with it and the hit-point-gated proposal operations decide with it. Tier plans author no maintenance or source
immunity, and a cast pick cannot also tier.

**Placed-zone damage dice (SPELLS-20 T1, D133, current).** A zone whose failed entry save deals authored dice
(`valueKind: 'DICE'`, a plain `NdM`) compiles those dice into the zone's one frozen entry graph: `damage-enabled`
(the movement-interruption authorization) gates one `evidence.optional-integer-range` node per die, sum nodes add
them, and `proposal-on_save_fail` takes the last sum as its amount. A die is therefore an ordinary roll request
(`isDamageDieRequest`), not a second graph. A flat modifier, bonus, scaling or half damage on a zone is refused
(`unsupported`; half damage is SPELLS-20 T4). Each spatial candidate runs the d20 stage and then its die stages: the
pending candidate carries `diceStage` (the resolved d20) while the dice are answered, and every answer is one
`resolutionCommands` entry (`ENTER_INTEGER` or `SYSTEM_ROLL` for a die). The d20 belongs to the contacted creature;
the dice belong to the zone source's controller (`spatialPendingRollerActorId`: the source actor, the target when the
zone has no source), honoring that controller's auto-roll, and the GM may answer for anyone. The recorded dice stay in
the stored execution trace, which settlement reconstructs from (`reconstructTargetBoundActiveRuleEffectCompletion`), so a
settled entry never rerolls. `retainedSpatialReplayFaces` also replays the dice, but no caller passes `retained`
today. The movement that triggers an entry is not an undoable root (above); GM undo of a dice zone
removes the zone with its spreading Action, as for every placed zone.

**Source zones (SPELLS-20 T1b, current).** An authored `MANIFEST` `ZONE` with `attachmentKind: 'SOURCE'` compiles
through the same `zonePlacementPlan` as a placed space (`PlacedSpaceZone.attachment` becomes
`zonePlacement.attachment`); no aura-specific zone logic exists. It must be centered on its user (range `SELF` with a
sphere, so `CASTER_CENTERED`). `planEncounterPlacedZone` anchors it to the user's token (`anchorKind: 'TOKEN'`,
`TOKEN_LOCAL` circle at the token center), so `collectSpatialMovementCandidates` already handles the caster moving onto a
creature (`sourceMoved`) and a creature entering the aura. The circle's radius is the authored radius plus half the
token's width, which equals "from the edge of the caster's space" on-axis and is smaller on diagonals for a square
token (approximation, recorded in the SPELLS-20 handoff). The caster's spell save DC is known only at the cast and a
zone cast has no cast d20, so the zone's entering save is exposed in the action facts (`zoneEntrySavingThrow`), the
sheet resolves `actionMechanic.save.dc`, and the Worker pins it on the zone's `adapterFacts` under
`DND5E_SAVE_DC_FACT_KEY` when the zone is placed (`castSaveDcFactKey` on the zone entry). Zone limits are refused, never
partly honored: half damage, bonuses, scaling, per-turn caps and turn-based interactions stay SPELLS-20 T4.

Each choice also carries `range` when its compiled target policy has a measurable one, the range the evaluator that
handles the policy measures. A single-target policy that `singleTargetMeasure` accepts advertises `SELF`, `WITHIN` (Touch
is 5 ft; a distance without a long range, including the 0 ft swarm space), `RANGED` (normal and long) or `UNLIMITED`. A
point-area policy advertises its origin range, which `evaluateEncounterAreaTargetPolicy` measures
(`pointAreaOriginRange`): `WITHIN` the distance (never `RANGED`, the area evaluator ignores a long range) or `UNLIMITED`.
A policy neither evaluator measures leaves it off: a sight or special range, targeting that is not a single target with a
disposition (creature type restrictions only warn: `allowedCreatureTypeIds` names the only types the action affects and `excludedCreatureTypeIds` the types it does not, and `targetingExcludesCreatureType` reads both. Neither the compiler nor the single-target action evaluators refuse a single-target policy for them (movement reactions and area saves still do), the room raises the one overridable `TARGET_CREATURE_TYPE_EXCLUDED` warning for either list, only for a Creature target, since a Character's facts carry no creature type. The compiler refuses an area restriction, so an area spell has no per-target type gate), an area with no supported shape, a path override, or no policy.
`encounterActionChoiceRange` (`encounterActionRange.ts`) is the one mapping. `rangeLabel` is not derived from `range`:
it words the authored range with `rangeLabel` (`rangeLabel.ts`), the formatter the Sheet uses, so Touch reads "Touch"
(its 5 ft geometry stays in `range`) and a ranged weapon reads "150/600 ft" on both surfaces. Only a choice without a
policy keeps the label of its action mechanic.

Per-role visibility and the command flow are in
[live-sessions.md](live-sessions.md#encounter-commands); the decision is
[D103](../handoffs/phase-08-2-decisions.md).

### One pending-choice pause (current, RULES-2.T4a; ADR 0039 decision 3)

A held `ENCOUNTER_ACTION` occurrence waits on exactly one thing: `pause: { kind, payload }` on its pending
context (`EncounterPauseDto`, `packages/schema/src/shared/encounterPause.ts`). The kinds are `LEGENDARY_RESISTANCE`,
`REACTION`, `CAST_REACTION`, `INCOMING_GATE`, `ATTACK_RETARGET`, `ON_HIT` and `FORCED_MOVEMENT`; the schema checks
each kind's roller and d20 rules in one place. `D20_WINDOW` is the same union's member for the post-roll window and is
allowed only in the `ENCOUNTER_D20_WINDOW` context; nothing in `ENCOUNTER_ACTION` may produce it. Adding a kind adds a
union member and its settle, never a second pause field.

Every choice kind shares one lifecycle (`packages/rules-runtime/src/encounterSealedChoice.ts`): open a sealed bounded
choice (`openEncounterSealedChoice`, or `openEncounterAuthoredChoice` for a feature's own graph), take the option an
answer names (`chosenEncounterSealedOption`), and settle with exactly that index (`settleEncounterSealedChoice`). Each
kind's module keeps what was offered and its staleness checksum. The incoming gate is the one member that waits on a
d20 instead of a choice. The rules graphs resume only `LEGENDARY_RESISTANCE`, `REACTION`, `ON_HIT` and
`FORCED_MOVEMENT`; a held cast, ward or retarget pauses before the graphs run. GM undo of a held action cancels it
whatever its pause kind.

**Worker handler layout (current, RULES-2.T4b).** `planNativeLiveEncounterAction` no longer answers pauses inline. `apps/session-worker/src/nativePauseHandlers.ts` holds one exhaustive table, `{ [Kind in NativePauseKind]: NativePauseHandler<Kind> }`, so a new pause kind fails to compile until it has a handler. Each handler has `read` (turn the response into that kind's typed answer, refusing a missing decision or die) and, for the kinds the rules graphs resume, `settle` (continue the action into its execution). One module per kind: `nativePauseLegendaryResistance`, `nativePauseReaction` (`REACTION` and `ON_HIT`, which share the target's current reaction), `nativePauseForcedMovement`, and read-only `nativePauseCastReaction`, `nativePauseIncomingGate`, `nativePauseAttackRetarget`: cast, ward and retarget answers feed their own earlier steps of the planner. Shared types live in `nativePauseTypes.ts`. The planner calls `readNativePauseAnswer` once, then `settleNativePauseAnswer` where it used to branch per kind.

**Live room layout (current, RULES-2.T13a).** `NativeLiveSessionRoom` keeps the Durable Object lifecycle, command dispatch and field wiring; it hands each responsibility to a module with a typed port instead of growing in place. `roomSocket.ts` owns the shared room vocabulary (socket attachment schema, `Admission`, `TransientCache`, `send`, `viewer`, `accountBucket`). `roomSceneCommit.ts` owns the Scene commit paths (fog staging, inline edit/undo/fog publication, geometry and movement-decision commits) and declares `RoomSceneCommitHost`, the stores and room steps (aggregate reload, authorization boundary, fanout, alarm) the room builds once in its constructor. **(T13b)** `roomCommandHost.ts` is now the one definition of what the room lends (`RoomCommandHost`); each module declares the `Pick` it uses (`RoomSceneCommitHost`, `RoomEncounterExecutionHost`, `RoomEncounterBindingHost`). `roomEncounterExecution.ts` runs every Encounter command (the ACTIVE-Run path and the local Encounter path, including movement decisions through `roomSceneCommit.ts`); `roomEncounterBindingCommand.ts` commits the GM's Encounter-to-Scene binding. **(T13c)** `roomCharacterSheetCommands.ts` runs held Character Sheet commands (`RoomCharacterSheetHost`) and `roomChatCommands.ts` runs Campaign chat commands (`RoomCampaignChatHost`), each beside the pure per-command helper it already owned. **(T13d)** `roomAdmissions.ts` (`RoomAdmissions`) owns the socket admission state (admissions, generations, in-flight sign-ins, early-challenge expiries, the one cold admission) and the authenticate, admit, challenge and close steps over it; `roomStorageAuthority.ts` (`RoomStorageAuthority`) owns the single authority activation and the single storage recovery; `roomAggregateLoad.ts` loads and reloads the held aggregate and journals an input reload; `roomActorSweeps.ts` journals actor departures and broken relationships after a commit; `roomLocalPlayAuthorization.ts` overlays unpublished local play onto an authorization read. Each declares the `Pick` of `RoomCommandHost` (plus, for admissions, its own extra steps) it uses. **(T13e)** `roomSceneCache.ts` (`RoomSceneCache`) owns the presented-Scene cache, its generation counter and the persisted copy a woken room restores from; `roomOutbox.ts` (`RoomOutbox`) owns the single publication flush, the checkpoint fence and the chat-backlog save; `roomPreviews.ts` (`RoomPreviews`) owns the transient preview streams, background refreshes and barrier indexes, and fans a sample out from room memory; `roomSceneCommandExecution.ts` runs a live Scene command (replay and rate checks, the write-set, the commit and its fanout). The room is now below the file-size budget; it keeps the lifecycle, socket entry points, command routing and the room-level steps the host lends. **(T13f)** `completeAreaCommit` in `nativeEncounterAreaRules.ts` is now the thin orchestrator of an area commit: it settles the forced movements and their collisions, then hands the rest to three phase modules. `nativeAreaCommitMaintenance.ts` opens the maintenance and zone planner the commit shares and opens the zone-only Concentration; `nativeAreaCommitPlan.ts` plans each creature's outcome in entry order (effects, joined maintained state, damage-ended effects, mechanics, Legendary Resistance audits, stored execution); `nativeAreaCommitPersistence.ts` settles the write-set (the caster's one spend, the settled actors, the Concentration the damage breaks, the rules after it) and returns the `AREA_COMMIT` plan. The phase modules import only types from `nativeEncounterAreaRules.ts`; the Legendary Resistance lookup is lent to the plan phase as a port. **(T13g)** `nativeEncounterAreaRules.ts` is now the planning entry points (action, answer, Legendary Resistance, removal, commit, forced movement) and the seal steps, below the file-size budget. `nativeAreaPreparation.ts` owns the shared area plan types and the preparation of the caster, Scene, reach, targets and cast window; `nativeAreaRevalidation.ts` owns the Legendary Resistance lookup, the sealed-save replay and the revalidation of a sealed or struck creature against current facts; `nativeAreaCommit.ts` owns `completeAreaCommit`, the forced-movement collision settlement and the commit input builder. Imports run one way: planning entry points → commit → revalidation → preparation; the only import back into the planning file is a type.

### Event hooks (current, RULES-2.T5a-c; ADR 0039 decision 4)

An effect or a reaction subscribes to events through authored data; a feature never adds a call site. The pieces live in
`packages/rules-runtime/src/events/` and never import `systems/*`:

- **Event table** (`encounterEventTable.ts`). `EncounterEvent` is the structural facts every System has: `ACTION`
  (whether it makes an attack roll or casts a spell, and whether it is aimed at an enemy), `ATTACKED`, `HIT`, `TEST`
  (`CHECK` or `SAVE`, with its ability by code or definition id, or none), `DAMAGED` (`AFTER` it lands: damager,
  damage types, dispositions; `BEFORE` it lands: the current hit points it takes the holder from and to), `HIT_POINTS_REGAINED`, `INCAPACITATED` (of the holder or of named sources), `CONDITION_HELD`,
  `ITEM_RELEASED`, `ACTION_USED_ON_HOLDER`, `IDLE_TURN`, `MOVED`, `AREA_LEFT`, and the events a reaction answers:
  `HIT_BY_ATTACK` (melee or not, attacker seen or not, the damage types the hit deals), `SPELL_CAST_BY_OTHER` and
  `TARGETED_BY_CAST` (with the spell cast), and the events an intercept answers before they resolve: the `BEFORE`-phase
  `DAMAGED`, `KILLED` (an outright kill) and `HARMFUL_ACTION_AIMED` (an attack or harmful spell, by an attacker of a
  Creature type or a Character). `EncounterEventSubscription`
  is what a hook listens for, with its filters; `EncounterEffectHook` is what it does when met (`END`, or `REPEAT_SAVE`
  with its trigger). Ending and consuming are the same hook: the effect is gone, restored by the same receipt.
  `EncounterReactionHook` is the reaction an event offers, by the event and the authored trigger it met.
- **Event vocabulary** (System capability `event-vocabulary`, `EventVocabularyCapabilityAdapter`, registered through
  `createSystemCapabilityRegistry` in `platformPolicyModules.ts`). The System maps its authored codes to subscriptions:
  the 5e adapter (`systems/dnd5e/eventVocabulary.ts`) reads `consumeOnFirstEvents`, `endOnEvents` (`ON_ATTACKED` is
  `ATTACKED`, `ON_SAVING_THROW` is `TEST SAVE` over `SAVING_THROW_MODIFIER` grants, and so on), `endOnTriggers`,
  `endOnConditionIds` and `repeatTriggers`. Each effect is read through the System its frozen graph was compiled for
  (`frozenGraph.source.gameSystemId`), fail-closed. The persisted codes are unchanged; T9 makes them System-supplied data
  and swaps only the adapter's source. Effects of both definition versions subscribe.
- **Discovery** (`discoverEncounterEventHooks` in `encounterEventHooks.ts`) is the one entry point: given a holder's
  effects and the events raised on it, it returns the effects ended (held order, each once however many events it
  meets: a spell attack is an attack roll and a cast), the effects whose save repeats with the first trigger met, and
  the passive damage grants a `DAMAGED` event of their types meets. `endSubscriptions` (`effectHooks.ts`, which reads
  the vocabulary and stays clear of Encounter rules for the browser, ADR 0036 S6) reads an effect's end subscriptions
  where a caller only asks what it listens for (`stateBoundGrants`, a zone's `AREA_LEFT` hold). A rest is the Sheet's
  event: `activeEffectEndsOnRest` reads the `REST` subscription there, and no Encounter raises one.
  `effectEventScope` (whose events and turn an effect meets), `damageTriggerMet` and `damagerOnSourceSide` live here too.
  Given the holder's `reactions` too, it returns the reactions the events offer, in held order, each once with the first
  hook met. A reaction's authored `reactionTrigger` is its subscription, already structural, so no vocabulary reads it:
  `ATTACKED_SELF` meets a hit its qualifiers admit (melee only, attacker seen), `DAMAGE_TAKEN` a hit dealing a type it
  names (it names the types that triggered it), `SPELL_CAST` another's cast when the reaction cancels it, and
  `TARGETED_SELF` being chosen by a cast of a listed spell (any, unlisted). The holder's reactions are listed by
  `encounterReactors.ts` (a Creature's feature actions, a Character's actions and castable spells), and whether one is
  affordable is decided when the Worker prepares it. A `MOVEMENT` reaction meets no event here: the movement path
  discovers it from the reach a mover passes (`encounterMovementReaction*`); zone interactions join in T5d.
  Given the holder's `damageInterceptions` and `incomingGates`, it returns the intercepts the events meet before they
  resolve, in the order given (spend order); an intercept's authored payload is its subscription. A damage interception
  (`DAMAGE_INTERCEPTION`, Death Ward) meets a `BEFORE` `DAMAGED` taking its holder from above 0 hit points to 0, and a
  `KILLED` when it negates kills: `hitPointsAfterDamage` and `killInterception` (`encounterDamageInterception.ts`)
  ask discovery, and both the planner (`applyDamageInterceptions`) and the fold that validates it call them, so a
  filter added to the subscription reaches both. The `BEFORE` `DAMAGED` event carries the whole blow (`damageTaken`,
  `damageTypeId`, `critical`), and a damage interception may filter on it (SPELLS-33.T4i2a): `excludes` (damage types
  and critical hits it does not meet) and `maxDamageTaken`. Its optional `save` (ability, DC `base` plus the damage
  taken when `plusDamageTaken`) is spent only on a pass: each save takes the next of the batch's
  `interceptionSaveRolls` (`{ rawDie, addedTotal }`, caller-supplied like `deathSave`), a failure lets the blow meet
  the next interception, and a missing die is an `EncounterValidationError`. The DAMAGE receipt records every save
  asked as `interceptionSaves`; the fold recomputes them and refuses a mismatch. An incoming gate (`INCOMING_ATTACK_GATE`, Sanctuary)
  meets a `HARMFUL_ACTION_AIMED` by an attacker of a listed type: `heldIncomingGate` lists the wards the attacker has not
  passed and asks discovery which one it meets. Counter and targeted-self windows are reactions to
  `SPELL_CAST_BY_OTHER` and `TARGETED_BY_CAST` above; a retarget stays the gate's failure pause.
- **Maintenance link** (RULES-2.T8; System capability `maintenance-link`, `MaintenanceLinkCapabilityAdapter`). Concentration
  is a neutral link keyed by the System's `maintenanceDefinitionId`; the 5e adapter (`systems/dnd5e/concentrationPolicy.ts`)
  supplies `MaintenanceLinkHook`s in priority order: `BREAK` on `DEFEATED`, `INCAPACITATED` of the holder or
  `MAINTENANCE_BARRED` (a held casting lock), each naming its persisted end reason, and `SAVE` on any `DAMAGED`. Discovery
  returns `maintenanceBreakReason` (the first break met) and `maintenanceSave`. `encounterConcentrationEndReason` raises
  one event, short-circuiting in that order, and `concentrationSaveApplications` binds the damage applications that owe a
  save, from both the Worker and the movement path. The adapter also owns the Constitution ability, the DC formula and the
  holder's save facts; callers pass the Run's `gameSystemId`, fail-closed. Gate DCs, holder save rows and added saving-throw
  dice read the `saving-throw` capability (`SavingThrowCapabilityAdapter`), ability codes and modifiers the `ability-score`
  one, so no Concentration or incoming-gate importer reaches into `systems/dnd5e`.

**One dispatch per event** means one subscription-reading dispatch per event kind, not one raise site. Callers state
facts (`{ kind: 'TEST', test: 'CHECK', ability: { code } }`) and discovery decides what fires; the release helpers in
`encounterEndedEffectRelease.ts` (`actionEndedEffects`, `targetEndedEffects`, `attackHitEndedEffects`,
`savingThrowSpentEffects`, `moveEndHolds`, `actionUsedOnHolderEndedEffects`) and the holder-state readers in
`encounterGrantLifetimes.ts` build events and call it. The raise sites stay where the pipelines commit: `DAMAGED` is
still raised from its seven damage-commit roots (Worker rules, area rules, Legendary action, turn effect state, spatial
damage ends, movement reaction effects, turn resources), since funnelling them into one damage-commit root is an
envelope change outside T5. The `BEFORE`-phase `DAMAGED` and `KILLED` are raised where a batch plans and folds its
damage, and `HARMFUL_ACTION_AIMED` where the incoming gate is decided. Zone interaction kinds (T5d) join the same table later.

### Legendary Resistance on single-target saves (current, D104)

A failed Creature save on a single-target `RESOLVE_ACTION` TEST that ends `ON_SAVE_FAIL` holds the action
before its OUTCOME runs. The `ENCOUNTER_ACTION` pending context keeps a sealed `LEGENDARY_RESISTANCE` pause
with the creature as roller, and nothing is spent while it waits. The answer is the existing `DECLINE` or
`OPTION` resolution, read as the `LEGENDARY_RESISTANCE_CHOICE` summary; the room rebuilds the TEST from the
retained faces without rolling, re-checks the offer against the creature's current pool, and continues the
OUTCOME on the success branch for USE or the failure branch for DECLINE. On USE the charge is written into the
action receipt as `targetFeatureResourceConsumption`, and GM undo returns it. Area, movement and single-target
paths share `decideEncounterLegendaryResistance`. The decision is [D104](../handoffs/phase-08-2-decisions.md).

### Reaction to a hit (current, REACTION-4.T1)

A reaction authored with `reactionTrigger: { kind: 'ATTACKED_SELF' }` (Shield) is offered to the attacked
Character when a single-target `RESOLVE_ACTION` TEST resolves `ON_HIT` or `ON_CRIT`, before the OUTCOME. The
`ENCOUNTER_ACTION` pending context keeps a sealed `REACTION` pause (a stack so Counterspell chains can nest later) with the Character as roller; nothing is spent while it
waits and the Scene is held (D26, text "Waiting on a reaction decision"). The answer is `DECLINE` or
`OPTION`, read as the `REACTION_CHOICE` summary; the room re-opens the choice graph by occurrence id, as
Legendary Resistance does.

DECLINE continues the OUTCOME unchanged. USE runs the reaction's own plan (`applyNativeReactionEffect`),
prices the reaction through the action economy and the slot through Character mechanics, builds the effect
it creates on its reactor, and re-evaluates the TEST: `reconstructNativeActionTest` rebinds the recorded
dice to the attack's defense as the effect leaves it. That rebinding is a sealed `adjustment`
(`defenseBefore`, `defenseAfter`, adjusted-facts checksum) in the OUTCOME's `reaction` audit and the
receipt; the "TEST evidence is stale" guard stays intact for everything else. The batch receipt's `reaction`
carries the spend and the effect; GM undo returns the slot and the allowance and deletes the effect.

Order on one attack: TEST, then the reaction choice (`ON_HIT`/`ON_CRIT` only), then the OUTCOME. It cannot
meet Legendary Resistance on the same TEST: that choice exists only for `ON_SAVE_FAIL` and a TEST has
either an attack path or a save path, and `continueNativeActionAfterTest` rejects an audit carrying both.
A defeated reactor (D63), a spent allowance, an Unconscious Character and a `REACTION_COUNT SET_VALUE 0`
grant (D99) all drop the offer through the same discovery as an action. Every eligible reaction is offered
as a menu (a reactor has one reaction a round, so one choice), and a reaction taken as an action is refused (`REACTION_TRIGGER_ONLY`) on
every action path (single-target and area) through `refuseActionOutsideItsWindow`, the one admission point it
shares with `LEGENDARY_WINDOW_ONLY`. Resume admission accepts any option the offer carries
(`offeredDecisionOptionIds`) and refuses one it does not as stale. Settlement answers the reaction whose use
option was chosen (`chosenEncounterReaction`; a decline answers the innermost), and the Worker re-discovers
that reaction by its `actionId`, so a non-first offered reaction is the one settled. The pending summary lists every offered option (`REACTION_CHOICE.options`, 1 to 8) and the Decision drawer shows a
button for each; every pin names the same reactor. The reaction's effect id is derived from the command and occurrence ids
(`encounterReactionEffectId`, rules-runtime), so replaying the answer mints the same id. A reaction that needs rolls or does not
create exactly one effect on its reactor is refused as `REACTION_UNSUPPORTED`.
Decision: D26 is extended to hold the Scene for a pending reaction decision.

#### Creature reactors and `ATTACKED_SELF` qualifiers (current, SPELLS-33.T4k1)

A Creature reactor is discovered the same way (`encounterReactorCandidates`): its reactions are the
`REACTION`-activated actions its own turn reads through `discoverEncounterFeatureActions`, and its controller
(the GM unless a player controls it) answers the choice. Its pin and candidate carry no Character
(`characterId`/`characterStreamVersion` both null), and the receipt is the `ENCOUNTER_ACTOR_MECHANICS_BATCH`
`reaction` (`encounterActorReactionReceiptDtoSchema`: the reactor's allowance and effects, no slot); commit
checks the reactor is the batch target, and undo restores the allowance as for a Character. A Creature reaction
that spends a feature resource is not offered yet.

`ATTACKED_SELF` takes two optional qualifiers: `attackRange: 'MELEE'` admits only a hit whose trigger is an
installed melee attack trigger (`isInstalledMeleeAttackTrigger`), and `requiresSight` only a hit whose attacker
the reactor sees, read from the attack's perception (`attackSight.actual.targetSeesAttacker`). Parry is authored
with both (`parryReaction` in the SRD creature data) and grants an `ARMOR_CLASS` bonus whose lifecycle is
consumed `ON_ATTACKED`. Such an effect counts against the answered attack's TEST and is never kept when that
action makes an attack roll (its `ATTACKED` end subscription, `endSubscriptions`), so the receipt's `activeEffectTransitions`
is empty and the next attack sees the original Armor Class. Shield, whose effect lasts the round, is kept as
before.

#### `SPELL_CAST` (current, REACTION-4.T3b-2; D126)

`reactionTrigger: { kind: 'SPELL_CAST' }` binds a reaction to a creature casting a spell (Counterspell). The
`CANCEL_TRIGGERING_EVENT` outcome compiles to `dnd5e.cancel-triggering-event-proposal`, a target-only proposal
that stores nothing; `executionCancelsTriggeringEvent` reads it from the committed trace, as
`executionAddsSpeedToMovement` does.

Before a Character's single-target spell cast runs its graph, the Worker (`nativeEncounterCastReaction.ts`) asks
event-hook discovery (a `SPELL_CAST_BY_OTHER` event, see "Event hooks") which other Characters hold a reaction for it, keeps those whose own invocation range
reaches the caster on the Scene and that the reactor can afford, and
holds the cast in a `CAST_REACTION` pause (`REACTION_CHOICE` to the reactor). Declining records the reactor
and the cast proceeds; using the reaction commits a countered cast (`persistEncounterCounteredCastCommit`): the
caster's slot and action and the reactor's slot and reaction are spent, nothing else is applied, and no
Concentration starts. Undo restores both creatures. Character ACTORS-target and area casts hold the same
`CAST_REACTION` pause (REACTION-4.T3e-a): the pause is a KERNEL_EVIDENCE `ENCOUNTER_ACTION` occurrence on the area root,
each answer replays the root command, and the next transition (area pending, area commit or countered cast) continues
that occurrence; the area commit input carries `failedCounters` and spends them like the single-target commit.
A Creature capability is offered a counter only when its Feature action effect sets `spellCast` (D136); a spell attack without it is never counterable. Casts made without the Scene offer no reaction. The chain is described
below (T3d).

**Higher-level check (current, REACTION-4.T3c; D127).** `reactionTrigger.higherLevelCheck` (`{ ability, baseDc }`)
makes a reaction cast below the triggering cast's level owe an ability check at DC `baseDc` + the cast's level
(`castReactionCheckRequirement`). The offer carries `check` (the sealed choice, trigger level, check definition, DC
and the reactor's d20 context) while the cast waits on the reactor's roll; the roll settles through the held-die rules
(`ENTER_DICE`/`SYSTEM_ROLL`, or the app roll for an auto-rolling player). A pass is a countered cast whose
`counter.check` seals the d20. A fail is a _failed counter_ (`failedCounters` on the pending context): the reactor
joins the declined set and is not offered again, and the cast's terminal commit (normal or countered) spends every
failed reactor's slot and reaction atomically with the cast (`failedCounterSpend.ts`), so one undo reverses them all.
Spend receipts are planned at the terminal against the reactor as it stands, not when the check fails. A reactor that
is the cast's target spends through the target's own mechanics call.

**Counterspell chain (current, REACTION-4.T3d).** A counter that stands (its check passed or none was owed) is
itself a cast: the offer's `chain` (`counters`, `castDeclinedReactorActorIds`, `castLevel`) holds the standing counters
in order, and the next level offers the other Characters, except the creature whose cast it answers and any reactor that
already used a counter in this cast, a counter to the last one. The original caster is therefore offered a counter to a
Counterspell cast against its spell (never to its own cast), planned against the slots its cast leaves. Range, check level and target are measured against that counter's
caster (`discoverNativeCastReactions` `against`). Each answer adds one counter, so depth needs no cap in code. When a
level has nobody left to ask the chain resolves by parity (`advanceNativeCastReactions`): odd, the first counter stands
and the cast is countered; even, the chain is spent without effect and the cast is offered again at its own level with
its declines restored. `failedCounters` holds every counter used that did not counter the cast (a failed check, or
itself countered; `againstActorId` records the cast it answered), all spent with the cast's terminal commit. The
persistence validators (`actionPending.ts`) check this bookkeeping by set equality.

A creature that makes several spell spends in one terminal commit (the cast's caster: the cast, then its counter)
commits them as one mechanics batch: `EncounterMechanicsBatchInput.characterSpellConsumptions` is an ordered list, each
entry fenced by the same `expectedStreamVersion`, its own `beforeUsed` and `afterUsed = beforeUsed + 1`, applied in order
with one stream bump (`planEncounterMechanicsBatch`). Discovery prepares the caster's counter against a target with the
cast's slot already spent (`projectSpellSlotSpend`), on the same Character version, so the offer matches what commits.

#### `DAMAGE_TAKEN` (current, REACTION-4.T2)

`reactionTrigger: { kind: 'DAMAGE_TAKEN', damageTypeIds }` (a user-authored Absorb Elements) rides the same
pause as `ATTACKED_SELF`: discovery (a `HIT_BY_ATTACK` event, see "Event hooks") offers it when one of `damageTypeIds`
is a damage type of the hit attack's `ON_HIT`/`ON_CRIT` outcomes (`attackHitDamageTypeIds`). The candidate and
the sealed pin carry their `trigger`, so a changed trigger is a different offer. The reaction's effect carries
a `DAMAGE_RESISTANCE` grant, which `encounterActiveGrants` turns into a defense of the reactor; the
re-evaluated binding hands that defense to the OUTCOME, so the damage is resisted before it applies. The TEST
is unchanged (`defenseBefore === defenseAfter`), so "the reaction changed the attack" compares the binding's
defenses as well as the bound facts. The follow-up benefit is an ordinary grant in the same effect (a melee
`DAMAGE` bonus until the end of the caster's next turn, scaled by the slot level the reaction was cast with).

The resistance names the triggering damage type rather than a fixed one (`damageTypeSource: 'TRIGGER'` on a
`DAMAGE_RESISTANCE` payload). Discovery returns the authored types the hit dealt (`triggerDamageTypeIds`), and
`prepareEncounterActionEffectPlans` binds the resistance to each, so a hit of cold resists cold only, though the
spell names fire and cold. An ON_CRIT type counts only on a critical hit (`attackHitDamageTypeIds`). A grant
amount that scales by slot level (`SPELL_SLOT_LEVEL`: Absorb Elements' bonus per slot level, Aid) is fixed by the cast level when the compiler builds the effect plan (`modifierGrantEntryPlan`, from the entry point's `spellCastLevel`; a plan without a cast level stays manual). The follow-up
bonus is consumed by the first attack roll (`ON_ATTACK_ROLL`). Limits: only the attack-hit path pauses
(save-based and area damage do not offer it), and the follow-up is spent by any attack roll of its holder, not
only a melee hit (see future enhancements).

### 0 hit points (D63, current)

A Creature or custom Run actor stores `defeated`. `nextEncounterActorDefeated`
(`rules-runtime/encounterActorDefeat`) sets it when a change takes the actor from above 0 hit points to 0
and clears it once the actor has any; an actor at 0 of 0 (a lair or hazard) is never defeated. Every Run
hit-point write uses it: `planEncounterMechanicsBatch` (all damage and healing paths), the GM's
`UPDATE_ACTOR` edit and `REVERT_LAST_ACTION`.

A defeated actor takes no turns (initiative skips it but keeps its place), no reactions or opportunity
attacks (`encounterMovementReactionSources`), no Legendary Actions and is no Legendary target
(`encounterTurnLegendaryDiscovery`). It is never a Cleaving continuation target
(`buildEncounterCleavingCandidate`), has no action choices and cannot act (`ACTOR_DEFEATED`) nor, for a
player, move its token. Naming one as a `RESOLVE_ACTION` target is the overridable `TARGET_DEFEATED`
warning; Disarm refuses it.

A Character at 0 hit points is never defeated; it is dying (D96). Dropping to 0 adds the System's 0 hit
point condition (`creatureConditionCapabilityRegistry`'s `zeroHitPointsConditionDefinitionId`; D&D: Unconscious), and regaining hit points removes
it, in `planEncounterMechanicsBatch` and the Sheet's hit point commands. `REVERT_LAST_ACTION` removes it
with the damage that caused it and refuses to undo a heal that woke the Character.

A Character's play state carries `hitpoints.deathSaves` (`successes`, `failures` and `stable`; every
creator writes zeros). The pure rules live in one module, `schema/shared/characterDeathSaves`, because the
receipt replay in `schema` must apply the same arithmetic as the writers: the Encounter mechanics fold
(`encounterCharacterMechanicsBatch`), the Sheet reducer (`sheetCommandReducer`) and Undo
(`actionRevert`, which restores the previous `deathSaves` exactly).

- Damage that drops a Character to 0 and overflows by at least its maximum is massive damage: dead.
- Damage at 0 adds a failure (two for a critical hit, `DAMAGE.critical`), clears `stable`, and is dead
  when the damage is at least the maximum.
- Three failures is dead; there is no separate flag.
- Regaining hit points from 0 resets the saves. A dead Character ignores healing (`HEAL`).
- A Sheet hit point edit above 0 revives a dead Character; the Sheet applies the damage rules with
  `critical` false.

A dead Character is treated like a defeated Creature wherever the Run reads defeat
(`isEncounterActorDefeated`, `skippedEncounterActorIds`, `defeatedEncounterActorIds`), but the Run
keeps no copy of it (ADR 0034 decision 4): the death fact is read from the live Character play record as a
`DeadCharacterIds` set (`readDeadCharacterIds` in persistence, the `characterDead` flag of the room's
`ACTOR` capture, and `deadCharacterIdsOfTargets` for state staged inside one turn or batch). Everyone
sees a dead Character as "Dead" through the Defeated presentation. A frozen actor (a completed Run, or a
departed Character) no longer reads its Character and reads as not dead. In an ASSISTED Run a dying
Character (0 HP, not stable, not dead) makes a death save as its turn starts (D96, current): a d20 with
no modifiers, rolled by the actor's controller through the roll prompt (`DEATH_SAVE` trigger) or by the
auto-roll preference. 10 or more is a success, 2-9 a failure, a 1 two failures, a 20 regains 1 HP (resets
the saves and removes the 0-HP condition through the heal rules); three successes stabilize, three
failures kill. `deathSavesAfterRoll` (schema) owns the rule. The stage runs after Recharge and before
incoming `START_OF_TURN` effects and is not undoable; a MANUAL Run prompts nothing.

First Aid (D98, D106 slice D, current) is an authored basic action on the reusable `CHECK` action test: the
actor makes one authored check (`invocation.check`: `checks` plus a `FIXED` dc; a `CONTEST` dc is in the schema
and refused by the compiler until ATTACK-7 slice C) and the `ON_CHECK_SUCCESS` path runs only on success. The
dnd5e compiler supports exactly one check and a `STABILIZE` outcome; the planner admits `CHECK` only on the
`BASIC_ACTION` source. The SRD authors First Aid as an Action with Wisdom (Medicine), DC 10, a touch-range single
target. It resolves through `RESOLVE_ACTION`, and the stored root carries the check occurrence receipt
(`checkReceipt`). The target comes from the command (a custom actor is refused and a MANUAL Run refuses it as `ASSISTED_ONLY`). A target
that is not dying gives the overridable `TARGET_NOT_DYING` warning and, once overridden, spends the
Action with no roll. Touch range reuses the Healer's Kit warnings. The root command always commits and
spends the Action and the helper's one-roll `ON_ABILITY_CHECK` grants (a Help) are consumed with it. A prompted roll writes a PENDING occurrence
(`ENCOUNTER_BASIC_ACTION_CHECK`) answered by a separate `RESOLVE_RULE_OCCURRENCE`; an auto-roll
settles at once. The roll card is credited to the helper, never hidden from the GM, and de-duplicated
by the app-roll attempt identity. GM undo restores the Action, the used Help and the target's death
saves, restores the consumed grants and keeps the roll on the record; it is refused while the check is pending
(`packages/encounter-persistence/src/basicActionCheck*.ts`, `packages/rules-runtime/src/encounterBasicActionCheck.ts`).
Spare the Dying and Sheet tracking of death saves are not built (target).

**d20 window (SPELLS-31.T4c1a, current).** A roller holding `AFTER_ROLL` rolled dice on its own active effects pauses a rolled d20
before the check settles. Two commands act on one occurrence: the d20 response pends a second `ENCOUNTER_D20_WINDOW`
`KERNEL_EVIDENCE` snapshot (discriminated `source`, today `BASIC_ACTION_CHECK`; no rule receipt, version +1), then
its `pause` is the `D20_WINDOW` member of the one pause union. `D20_WINDOW_USE { requestId, optionId, faces? }` or
`D20_WINDOW_DECLINE` resumes the System-owned bounded choice (index 0 declines),
appends the die to the d20's `addedDice`, settles the check with the final total and ends the spending effect in the same transaction.
A GM void of a window is refused. Options and their ids derive from the held grants and the roll's evidence checksum, so a homebrew
die or trigger runs the same path. Rolled-die faces stay a d4 (`ROLLED_DIE_FACES`).
(`packages/rules-runtime/src/encounterD20Window.ts`, `packages/encounter-persistence/src/basicActionCheckResponsePersistence.ts`).

Hide and Search (ATTACK-10.T1, current) are authored `SELF` check actions with per-observer outcomes, built from generic
options (ADR 0038); nothing in code names Hide.

- **Authored shape.** Hide checks Dexterity (Stealth) against `dc: { kind: 'PASSIVE', passiveDefinitionId }` (the System passive,
  for example Passive Perception, whose skill is the passive's authored `skillDefinitionId` in the System) and applies `CONCEAL_FROM_OBSERVERS
  { observers: 'NON_ALLIES' }` for an `UNTIL_DISPELLED` duration that is consumed by `ON_ATTACK_ROLL`. Search checks Wisdom
  (Perception) against `dc: { kind: 'CONCEALMENT' }` and applies `DETECT_CONCEALED`. Both compile to the existing check
  pipeline with a `resolution` discriminant on `BASIC_ACTION_CHECK` (`CONCEAL` or `DETECT`); Escape keeps its own command.
- **Per-observer DCs freeze at creation.** The pending check context holds each observer's passive score, or each concealment the
  actor can search, so the settle needs no further loads and the player's pending read keeps `dc: null`.
- **State.** The stored effect is a `schemaVersion 2` active rule effect whose immutable definition carries
  `LOCATION_CONCEALMENT { concealmentTotal }`; the observers it still hides the holder from live in the mutable lifecycle
  (`concealedFromActorIds`, sorted, unique). Search, the GM command and the movement prune change that set through
  `updateLifecycleCas`. A set that would become empty ends the effect in that same write (`deleteCas`), whichever of Search, the
  movement prune or the GM command emptied it, and the receipt (root `consumedGrants`, the prune entry, the observer receipt's
  `endedEffect`) keeps the record so undo re-creates it exactly. A settled Hide replaces the roller's existing concealment the
  same way: the old effect is deleted in the settlement and recorded in the root receipt, so undoing the Hide restores it.
- **Ties go to the observer.** An observer notices when its score (passive, or Search total) is at least the Stealth total; the
  hider is hidden from observers whose score is strictly lower. One rule for both (`encounterConcealment.ts`).
- **Scene gating.** On a Scene an observer that really sees the hider has noticed it, so a Hide never freezes such an observer
  into the set (`resolveEncounterObserversSeeing`, read by the Worker per observer on the action's locked Scene) and the Scene's
  sight decides at attack time. Without a Scene (the neutral environment, where everyone sees everyone, D94) the GM decides the
  circumstances: the persisted observer set is authoritative.
- **Attacks.** Off a Scene, `resolveAttackSight` treats a subject as `UNSEEN` by an observer its concealment still hides it from,
  whatever the observer's Senses (D100); on a Scene the Scene decides. The attack-roll caption and advantage follow the existing
  unseen-attacker path. The believed
  mode must not reveal which observers failed, so it treats the hider as hidden from any non-allied target while a concealment
  exists; the true mode uses the set and may cancel it ("Advantage cancelled: the target can sense you"). The first attack
  roll consumes the concealment for everyone (`discoverEncounterEventHooks`, SPELLS-27: any effect that lists the event in `consumeOnFirstEvents` or
  `endOnEvents`, so Invisibility ends the same way).
- **Redaction.** The observer ids are GM knowledge. They live only in the stored effect and receipt; no player projection,
  timeline line, pending read or roll card carries them, so the hider's and other players' views never name the observers.
- **Movement prune.** Committing an Encounter-bound token move on a Scene drops from each concealment the observers that now
  see the hider, when the hider's or an observer's token moved (`planConcealmentPrune` plans it from the predicted Scene and the
  movement plan's targets; `applyConcealmentPrune` writes it through `updateLifecycleCas`). The dropped ids are recorded in the
  room's `sceneConcealmentPrunes` evidence row keyed by the move command, and the GM's `UNDO_LAST_SCENE_MOVE` of that move
  gives them back (`restoreConcealmentPrune`) to a concealment that still exists, and re-creates one the prune ended unless the holder has a newer concealment.
  A standalone move (no Encounter version) cannot move a token bound to an active Run, so it has no prune. Automation MANUAL
  plans no movement targets, so it prunes nothing; the GM command is the override there.
- **GM command.** `SET_CONCEALMENT_OBSERVERS` adds or removes observer ids on an existing concealment (GM only, recorded in the
  receipt, undone by `REVERT_LAST_ACTION`). It is the override for lighting and other circumstances the engine does not
  derive.
- **GM projection (D116, AC 10.6).** The GM's actor projection carries `concealment` (`listConcealment` in `encounterConcealment.ts`,
  filled by `withActiveGrants` in `encounter-persistence/nativeProjection.ts`): the effect id the command targets, the frozen
  `concealmentTotal` and `observerActorIds`, or `null` when the actor hides from no one. It is `omit`ted from the stored Run actor
  state (`encounterRunState.ts`) and absent from the player actor contract (`encounterPlayerActorDtoSchema`), whose projector copies
  fields one by one, so no projection read or room frame to a player names an observer or the effect. The turn-order drawer lists every other actor as "Hidden from" (button: Stop hiding) or
  "Noticed by" (button: Hide) and sends the command; the set members are the observers the creature is hidden from. Proofs: the
  per-viewer unit test in `encounterPlayerProjection.test.ts`, the room test in `nativeRoomHideAction.test.ts` (the GM's commit delta
  has it, a player's messages never do) and the live journey `apps/web/tests/live-backend/encounterHide.ts`.

### Condition mechanics (D94, current)

A System's condition-rule-state definition authors what a condition does as data, in its `mechanics`
list (`packages/schema/src/shared/ruleState.ts`); the SRD seeds them in
`packages/source-data/src/srd/ruleState.ts`, and a homebrew condition authors its own the same way. There
is no condition-specific code. Each mechanic is one of:

- `D20_ROLL_MODE`: advantage or disadvantage on attacks by the holder, attacks against it (any, within or
  beyond a distance), its saving throws (some abilities or all) or its ability checks;
- `SAVE_AUTO_FAIL`: the holder fails saves of the listed abilities;
- `SPEED`: the holder's speed times `numerator / denominator`, rounded down (0 sets it to 0);
- `HITS_AGAINST_CRITICAL`: a hit against the holder within a distance is a critical hit;
- `APPROACH_SOURCE_FORBIDDEN`: a willing move of the holder that ends closer to the condition's source
  is a rule warning (ADR 0034 soft enforcement).

A `D20_ROLL_MODE` on attacks or checks may set `requiresHolderSeesSource`: it then applies only while the
holder sees one of the condition's recorded sources (a save mode cannot, since saves fold in at load).

**Condition sources (SPELLS-29, D134).** A condition outcome authored with `recordsSource`
(the authoring toggle "The Acting Creature Is Its Source", a core option) records the acting creature on
the `CONDITION_OWNERSHIP` contribution of the effect that owns it (`sourceActorId`). The SRD Fear spell and
every SRD Creature action that frightens author it. `encounterConditionSources` reads a held condition's
sources; a condition held before its effect, applied by hand, or owned by any effect without a source is
unsourced, and an unsourced condition's sight-gated modes always apply. Action preparation
(`prepareEncounterActionMechanics`) filters the attacker's and target's mechanics by sight through the
injected `loadSourcesSeen` (the Worker's `readNativeLiveSourcesSeen`, the attack-perception rules). Any
Encounter actor can be a source, not only the action's actor and target; a source no longer in the
Encounter, or with no token beside the holder's on the Scene, is unseen. A flow that injects none keeps
the modes always on. The room's initial voluntary or teleport move (`prepareNativeLiveMovement`; forced
moves never warn) refuses an unacknowledged approach with `RULE_WARNINGS` (`CONDITION_SOURCE_APPROACH`),
which `MOVE_SCENE_TOKEN.acknowledgedWarnings` overrides; the tabletop shows "Do it anyway". The move
receipt records no override yet. Undoing the action that applied the condition removes its effect and so
its source.

**Fleeing a condition's source (SPELLS-29.T2, D134).** A condition outcome authored with `fleesSource`
(the toggle "The Holder Must Dash Away From Its Source", shown only with `recordsSource`) adds `fleesSource`
to the effect's `CONDITION_OWNERSHIP` contribution. `encounterConditionFleeSources` lists the recorded
sources of the held, sourced, fleeing owners. An Action other than Dash taken by such a creature
(`RESOLVE_ACTION` and area actions; `encounterFleeActionWarnings`) raises the overridable
`CONDITION_SOURCE_FLEE` warning, and the turn movement projection (`turnMovement[].fleeSourceActorIds`,
read by `readTurnMovementView`) drives the tabletop's "Dash away from the source" prompt. Shown and
softly enforced, never blocked. SRD Fear authors it.

**Failure-margin rider (SPELLS-27.T11, D149).** An immediate `FOLLOW_UP_SAVE` whose failed outcomes are
timed conditions may author `failureMarginRider { id, failedBy, outcomes, lifecycle { endOnTriggers } }`:
one more condition applied when the save fails by `failedBy` or more. The compiler adds a
`nested-save-margin` threshold node (`dc - failedBy + 1`) and a margin-gated condition proposal, and the
plan carries `marginRider` (required, nullable) with its own `rider-condition-duration` node. The
encounter planner then creates a second active effect, the rider's, with the parent's duration and the
rider's own end triggers, so waking (`DAMAGE_TAKEN`, `ACTION_USED_ON_HOLDER`) ends it and leaves the
parent condition. A receipt may therefore carry two active-effect transitions. The rider is not linked to
the parent: ending the parent early leaves the rider for the GM to end. A follow-up save takes a rider, and so does the fixed `ON_SAVE_FAIL` result of a direct saving-throw action (SPELLS-33.T7b, D156): `failureMarginRider` on the result block ("fails by 5 or more, also paralyzed"). The TEST total is not in the OUTCOME graph, so the specializer derives `saveFailedBy` (DC minus total) from the TEST outputs (`testOutputs` on `specializeOutcomeTemplate`) and appends one result group per rider outcome only when the margin is met. `marginRiderPlan` builds the rider's second active effect for both the follow-up and the direct-save plans, and the rider applies only when one of its conditions lands. SRD Drow Hand Crossbow, Pseudodragon Sting and Sprite Shortbow author the follow-up form; the Mummy and Mummy Lord Dreadful Glare author the direct-save form with SOURCE_IMMUNITY. Limitation: that immunity is per source, so a save against one mummy does not make the target immune to other mummies (SRD text covers all mummies).

**Initiative restores (current, SPELLS-31.T5o).** A PASSIVE effect with `triggerCode: ROLL_INITIATIVE` (path code
`PASSIVE`) and a `RESTORE_RESOURCE { chargeId, floor, whenAtOrBelow }` outcome raises a feature charge when its
holder's initiative settles: Perfect Self (`kiCharge`, floor 4) and Superior Inspiration (`bardicInspirationCharge`,
floor 1), both at `whenAtOrBelow: 0`. It is a Character-only fact. `appendActions` (`characterActionRuleFacts.ts`)
lists the restores of a feature, option or feat effect (`character/characterInitiativeRestores.ts`, kept out of the
`encounter*` modules the web boundary test forbids) in `initiativeRestores` instead of the action sinks, and the
rule evaluation carries them as `initiativeRestoreSources`. `planCharacterInitiativeRestores`
(`encounterInitiativeRestores.ts`) reads the Character's resolved pools: a charge with no resolved pool restores
nothing and one that names two pools throws. A pool with at most `whenAtOrBelow` uses remaining is raised to
`floor`, never past its maximum; every source reads the pool as the roll found it, so two sources on one pool
take the higher floor in any order. The plan is applied as the `characterResourceRestores` of a Character
mechanics batch (the pool's `resourceUsage` row drops to the new `used`, refused as stale when the row is not what
the plan read). Persistence runs it at settlement, see [persistence](persistence.md). Equipment, Creature features
and a Reinforcement's own initiative roll are not discovered (T5o known gaps in
`docs/handoffs/slice-spells-31.md`).

**Source immunity (SPELLS-31.T5l, D156).** A creature can be immune to one source's use of one action.
Two authored forms compile to the plan's `sourceImmunity` (`sourceImmunityPlan`). A `SOURCE_IMMUNITY` outcome
on `ON_SAVE_SUCCESS` gives `appliesTo: SAVE_SUCCESS`, keyed by the action's effect id, lasting its result
block's `conditionDurationTurns`. `perTargetLockout` on an at-will `SPELL_GRANT` gives `appliesTo: EVERY_TARGET`,
keyed by the grant id, and is `INDEFINITE` (the source's long rest; a Run holds no rest, so it lasts the Run).
The encounter planner creates the immunity as a second effect on the holder in the plan's `riderEffect` slot
(`riderMaintained: false`, so it outlives the source's Concentration). It holds one `SOURCE_IMMUNITY` state
contribution `{ immuneToId, sourceCharacterId, sourceLabel }`. The compiler refuses a save immunity under
Concentration and a lockout beside a failure-margin rider. Admission (`encounterSourceImmunityLabel`) refuses a
single-target use against an immune holder ("Immune to <label>"), and an area leaves that holder out: the pending
area seals it as `unaffectedActorIds`, caught but not tested, so the persisted Scene check still matches. It matches
by source actor, or for a Character by source Character, since a carried effect outlives the Encounter actor.
A spell grant's `allowedCreatureTypeIds` narrows the targets of its casts (`targetingExcludesCreatureType`).
An area save that allows or excludes creature types catches every actor in it, and the same filter seals the
ones it rules out in `unaffectedActorIds` (D156, SPELLS-33.T3a3). The receipt's GM lines read "<label> was
unaffected". A zone refuses the restriction, since its entry saves do not filter by type. SRD Cloaker Moan
(excluding aberrations) authors it.
A save condition with no authored end compiles when it lasts at most one round, since no repeat save or end
event can fall inside that round. SRD Intimidating Presence (save immunity) and Chains of Carceri (lockout
and creature types) author it, as do the SRD Cloaker's Moan, the Nalfeshnee's Horror Nimbus, and the Frightful
Presence of the Tarrasque and the 20 adult and ancient dragons (SPELLS-33.T7a). The creature fears share
`minuteFearSaveEffect` in the source data: Frightened for a minute with a repeat save at the end of each of the
target's turns. A chosen option's spell grant reaches spell access through `snapshot.features` (SPELLS-31.T5t),
so Chains of Carceri is automated in play.

**Chosen-feature spell access (SPELLS-31.T5t).** `buildCharacterSpellRuleFacts` reads class, subclass and heritage
features from their compiled definitions, and Feats, Background features and selected options from
`snapshot.features` by provenance. Candidates and `spellAccess` carry source kind CLASS, SUBCLASS, RACE, SUBRACE,
FEAT, BACKGROUND or OPTION, plus `acquiredParentId` for OPTION. `findCompiledSpellGrant` is the one lookup from an
access to its authored grant, used by charge resolution and the Sheet projection.

**Repeat attempt gate (SPELLS-29.T1a, D134).** A `FOLLOW_UP_SAVE` repeated at the end of the
target's turn may author `repeatAttemptGate` (`allow: WHEN_MET | WHEN_UNMET` over the same target→source
`PERCEPTION` as `repeatRollInfluence`; the schema refuses the two together). The compiler pins it as adapter
facts and makes the frozen graph's `repeat-save-d20` an `evidence.optional-integer-range` enabled by the
bound fact `dnd5e.repeat-save-attempt-allowed`. When the gate refuses the attempt, the binding requests no
roll and the effect continues unchanged, or expires on its last tick; the save-test node still runs on
the settled minimum, so a refused attempt's graph outputs are not a save result and only the interpreted
`ATTEMPT_REFUSED` counts. Perception the room cannot resolve (no Scene, or a source with no token) is
unmet, as for `repeatRollInfluence`. SRD Fear authors `WHEN_UNMET` `SEE` (the save is made only out of the
caster's sight). The schema accepts a gate only on a save first made at the end of the target's turn, since
the plan for a save made at once on application carries none.

**Repeat-save thresholds (SPELLS-4.T2m1c).** A repeated `FOLLOW_UP_SAVE` authored `attempts: THRESHOLDS`
(`successesToEnd`, `failuresToResolve`, `consecutive`; `onSuccess` END, `onFailure` CONTINUE, no escalation) freezes
the three counts into the definition's neutral `recurrence.saveThresholds` and carries the running count on the
active effect as `lifecycle.saveTally`. Each end-of-turn save advances the tally in the same CAS as
`remainingTicks` (the turn plan's UPDATE `afterSaveTally`, covered by `afterLifecycleChecksum`; persistence
accepts only a one-save step, `isSaveTallyStep`, reading the mode from `recurrence.saveThresholds`: only a
`consecutive` tally may zero the opposite count). Reaching `successesToEnd` ends the effect. Reaching
`failuresToResolve` settles it: the attempt gate refuses further rolls, the effect stops saving and its
duration keeps counting down. `consecutive` zeroes the opposite count on each result. The tally is
system-neutral state and the thresholds are neutral definition data; only the adapter decides what reaching them means.

A mechanic with `minimumLevel` applies from that level of a leveled condition: a Character's exhaustion
level is a level of the System's Exhaustion condition, a Creature's condition row may record a level, and
any other held condition is at level 1.

`rules-runtime/encounterConditionMechanics` evaluates them. `withEncounterConditionMechanics` pins the
held conditions' current definitions on a movement target (`conditionDefinitions`) when the Worker loads
it (`nativeEncounterTargets`), and `applyEncounterConditionMechanics` derives `conditionMechanics` and
folds save contributors into the save rows; a flow that rebuilds a target re-applies it from the pins, so a
removed condition stops applying at once and a condition gained after the load applies from the next load.
Action preparation adds the attack contributors (attacker and target, measured on the Scene, or melee
within and ranged beyond without one) and the `conditionOutcomeRules` binding: the D&D compiler binds
`dnd5e.test-outcome-rule` (`NONE`, `SAVE_AUTO_FAIL`, `HIT_IS_CRITICAL`) into the v2 attack and save test
operations. Single-graph verification recomputes the result path from it, and a two-phase save seals it
in its TEST-phase bound-facts checksum (`requireNativeTestBoundary`). The d20 is still rolled on an
automatic failure. Contests (Grapple, Shove escape) and Disarm add the ability-check contributors, Dodge is
suspended at condition speed 0 (the `SPEED_ABOVE_ZERO` predicate), and the tabletop movement allowances (`readTurnMovementView`, one per speed type) apply the
speed mechanics before Dash. A condition contributor's derived-mode reason names the condition, and is
generic for players when the holder is hidden.

Not modeled (registered in the phase ledger): Unconscious falling Prone, Petrified damage
resistance, Exhaustion 4 and 6, concentration saves under conditions, and conditions on Convex-side
action preparation reads (the room owns resolution).

### Authored basic actions (ATTACK-18 slices A to E, current; D106)

A `BASIC_ACTION` System definition carries `rulesText`, `restrictions` (a nullable Facet, evaluated live: see Restrictions below), `actionCost` and `effects` (the same authored effect list a
Feature carries). Every entry is authored: Dash, Disengage, Dodge, First Aid, Help, Hide, Ready, Search and Use an Object. They are compiled by
the dnd5e effect compiler and run through `RESOLVE_ACTION` as the third action source, `BASIC_ACTION`
(`encounterBasicActionCapabilityDiscovery.ts`, `encounterActionSources.ts`), for Characters and Creatures. Their action id is
`${actor.id}:BASIC_ACTION:${definitionId}:EFFECT:${effectId}`, and the action choices read lists them in the separate
`basicActionChoices` group as ordinary `encounterActionChoiceDtoSchema` entries.

- **Manual adjudication.** The `MANUAL_ADJUDICATION` outcome compiles to the stored-state-free proposal
  `dnd5e.manual-adjudication-proposal`: the Action is spent and nothing is applied, so the GM rules the result. Every stored `RESOLVE_ACTION`
  command carries the resolved action's display label (`encounterActionSourceLabel` of the prepared source, for Character, Creature
  feature and `BASIC_ACTION` sources), and the timeline entry returns it. **Beside one executable outcome (SPELLS-4.T2a3, D156):**
  an `ON_USE` fixed `SEQUENCE` whose other outcomes are all `MANUAL_ADJUDICATION` compiles its one executable outcome as if
  it stood alone (`rulingSequence` in `effectActionCompiler.ts`), and each ruling becomes a further
  `dnd5e.manual-adjudication-proposal` node bound to its source entry, so the GM notes travel on the same commit. A sequence
  with two executable outcomes stays refused.
- **Dodge** is an `APPLY_GRANT` until the start of the holder's next turn with an `ATTACKS_AGAINST` disadvantage modifier
  (`requiresHolderSeesAttacker`) and a Dexterity `SAVING_THROW_MODIFIER` advantage, both under the facet predicates `CAN_ACT` and
  `SPEED_ABOVE_ZERO`, authored as one CHARACTER group and one CREATURE group (unknown contexts fail closed). `withEncounterHolderDefense` (`encounterHolderDefense.ts`) applies the grants
  to the target facts for attack and save resolution, and the target keeps the holder state it found (`holderState`), so
  `rebuildEncounterTurnTarget` re-applies the grants as they stand at each turn stage (SPELLS-20 T5d); the D100 sight rule drops the attack contributor only when the holder
  definitively can't see the attacker (`UNSEEN`). GM undo removes the grant and refunds the Action like any authored action.
- **Exempt senses and save-failure grants (SPELLS-4.T2k1, D156).** An `ATTACKS_AGAINST` modifier's
  `exemptAttackerSenseDefinitionIds` names the System Senses through which an attacker that sees the holder is unaffected
  (Blur: Blindsight, Truesight). A `TEST` whose only outcome is an `APPLY_GRANT` on its failed-save path compiles a
  result-gated grant plan (`saveFailureGrantPlan`, adapter fact `dnd5e.grant-authored-path`) and no OUTCOME graph, like
  `creatureFormPlan`: each creature that fails holds the grant (Enthrall).
- **Negated advantage and attack occasions (SPELLS-31.T4k2a, D156).** An `ATTACKS_AGAINST` `NEGATE_ADVANTAGE`
  modifier (Elusive) carries no contributor: while it holds, the sight contributors drop `ADVANTAGE` and preparation
  publishes `attackAdvantageNegated`, so the compiler drops every advantage from the final attack roll, the attacker's
  own grants and flanking included. An optional `attackOccasion` (`OPPORTUNITY`, Escape the Horde) limits a modifier to
  attacks made on that occasion; `prepareEncounterActionMechanics` takes the occasion as input, and a movement reaction
  attack is prepared as `OPPORTUNITY`. A Character holder's feature grants come from its grant fold (holder-state
  restrictions such as `CAN_ACT` apply), beside its active effects.
- **Attack decoys (SPELLS-4.T2k2, D156).** An `ATTACK_DECOYS` `ENABLE` modifier (`{armorClass: {amount, abilities}, thresholds: [{id, remaining, minimumRoll}]}`)
  with a path lifecycle `uses` counts the holder's decoys in `lifecycle.remainingUses`. `attackDecoyFor` derives the
  decoy d20 from the minted occurrence id; at or above the minimum for the decoys left the attack is prepared again against
  the decoy's armor class and the binding carries `absorbedByDecoy`, which makes the TEST `TEST_ONLY` and skips reactions and on-hit holds. A hit
  or critical spends a use (`spentUseGrants`, a lifecycle CAS at commit) or, on the last, ends the effect (`consumedGrants`); the root
  receipt keeps both so an undo restores them. Every attack path goes through `prepareAttackBehindDecoys` (SPELLS-4.T2k2b): the action,
  an opportunity attack (salted `${occurrenceId}:${reactorActorId}`, settled through `spentUseGrants` on the REACTION arm) and a Legendary
  attack (salted `${occurrenceId}:legendary:${ordinal}`, `decoyEffectId` in its evidence). An attacker that cannot see the target or has a
  sense in the payload's `exemptAttackerSenseDefinitionIds` (blindsight, truesight) never meets a decoy.
- **Incoming attack gate (SPELLS-4.T2k3, D156).** An `INCOMING_ATTACK_GATE` `ENABLE` modifier (`{savingThrow}`) makes any creature that
  targets the holder with an attack or a harmful spell first pass a save against the effect source's spell save DC.
  `advanceNativeIncomingGate` (session worker) runs before the cast-reaction pause: a prompted player rolls the save at a
  d20 pause (an `INCOMING_GATE` pause on the `ENCOUNTER_ACTION` context), anyone else is rolled server-side. A pass is remembered as
  `passedIncomingGate`, carried by every later pause so a replay skips the gate; a fail commits `ENCOUNTER_GATED_ACTION`, the
  source's spend with nothing of the action. Area effects are not gated. See the T2k3 handoff for the gaps.
  Before a failed save loses the action (SPELLS-4.T2k3b) the attacker is offered another creature: an `ATTACK_RETARGET`
  pause (`{gate, options}`) on the `ENCOUNTER_ACTION` context (`ATTACK_RETARGET_CHOICE` summary). `DECLINE` commits the same gated action;
  `OPTION` replays the command retargeted to the chosen creature (`retargetEncounterAction`; the admission and the worker derive
  the same command and fingerprint), so range, sight, visibility and any ward of the new target are evaluated afresh. The
  currentness checksum is exempt for that one transition.
  Holder-owned wards (SPELLS-31.T4k2b, D156): the gate also reads the holder's own feature grants from its grant fold
  (`heldIncomingGate`; Active Effect wards first, lowest id, then fold grants), where the ward id is the grant id and the
  holder owns the DC. `savingThrow` may be `DERIVED_DC` (`incomingGateSaveDc`: `baseDc` + the owner's ability modifier,
  proficiency bonus and static bonuses, as they stand now). An optional `attackerCreatureTypeIds` limits the ward to attackers
  of those Creature types (a Character has none, so it is never covered). Nature's Sanctuary is authored this way. The
  payload's `successImmunity {duration}` is authored and node-mapped but **not yet enforced**: runtime immunity needs the
  Character-target receipt to carry a SOURCE_IMMUNITY effect (T4k2c), so until then a passing attacker saves again on each attack.
- **Dash** carries the `MOVEMENT_RULE` kind `ADD_SPEED_TO_MOVEMENT`, compiled to `dnd5e.add-speed-to-movement-proposal`. The
  `RESOLVE_ACTION` commit reads it from the execution trace (`executionAddsSpeedToMovement`), calls `recordTurnSpeedBonus` and stores
  `speedBonusTurn` on the command; GM undo calls `removeTurnSpeedBonus`. The movement budget stays condition-adjusted speed × (1 + bonuses).
- **In-Scene teleport (SPELLS-28.2, Misty Step, Dimension Door).** A SELF `TELEPORT` outcome with a `VISIBLE` or `SPECIFIED_POINT`
  destination and a positive DISTANCE invocation range compiles to `dnd5e.teleport-allowance-proposal` (Dash pattern: no applications,
  the commit reads the stored trace via `executionTeleportAllowance`). The commit records a one-shot allowance (`castCommandId`, `maxFeet`,
  `destinationKind`, `consumedByCommandId`) in `encounterTurnMovements.teleportAllowances` and stores `teleportAllowanceTurn` on the command.
  It expires with the caster's turn row. A `MOVE_SCENE_TOKEN` `TELEPORT` spends it: the room selects the allowance
  (`selectTeleportAllowance`: smallest range that covers the distance, free footprint, `VISIBLE` needs an explored destination) and
  refuses a player's teleport that none admits (`TELEPORT_UNAVAILABLE`, or `MOVEMENT_BLOCKED` for range, occupancy or sight), while the GM's
  stays ungated and spends any unspent allowance. Publication marks it spent (`finish.teleportCastCommandId`). Undo order is the move first
  (`UNDO_LAST_SCENE_MOVE` restores the allowance in the same transaction), then the cast (`REVERT_LAST_ACTION` removes an unspent allowance
  and is refused once a move spent it). This is the one enforced movement exception in ADR 0034: the spell grants the move.
- **Forced movement (ATTACK-7.T5a/T5b/T5d, D139, D157).** A `FORCED_MOVEMENT` outcome in any direction (`AWAY_FROM_SOURCE`,
  `TOWARD_SOURCE`, `ASIDE` within the action's reach, `ANY`) with an `EXACT` or `UP_TO` distance compiles to `dnd5e.forced-movement-proposal` on its result path (no applications; the Balor's Whip and the Bronze
  Repulsion Breath use it, nothing creature-specific). `interpretSpatial` turns an authorized proposal into a `FORCED_MOVEMENT` directive,
  which the single-target and area room planners pass to the commit as `forcedMovements`. In the action's transaction the room's
  `applyRoomForcedMovements` moves each target, farthest first (ties by actor ID), to a square
  `deriveSquareGridForcedMovementDestinations` (`packages/shared/src/domains/vtt/optionalCombatGeometry.ts`) calls legal: along the
  straight square-grid ray from the source's token for away and toward, stopping before the first barrier or occupied square, or any
  free square within the distance for `ANY` (and within the source's reach for `ASIDE`), as a `FORCED` Scene move: no opportunity
  attack, no movement spent. When a single-target action's movement has two or more legal squares, the planner holds the settled
  outcome (`holdForForcedMovementDestination`, a bounded-choice continuation over the squares with the sealed completion and its
  OUTCOME phase) on a `FORCED_MOVEMENT_DESTINATION` pending; the source's controller or the GM answers `FORCED_MOVEMENT`
  `{requestId, position}`, the planner restores the completion without running a graph again
  (`restoreHeldNativeActionCompletion`, its retained OUTCOME replaying resistance, reaction and on-hit audits) and the commit
  re-checks that the square is still legal. An area action whose settled pushes owe picks holds them on its own
  aggregate snapshot (`forcedMovement {landed, pick}`, `holdEncounterAreaForcedMovement`), one creature at a time,
  farthest first: the room's `readRoomForcedMovementPick` lands the creatures already picked on a copy of the Scene
  (the same `landForcedMovements` simulation `applyRoomForcedMovements` commits with) and offers the next one's legal
  squares; each answer lands it (`landEncounterAreaForcedMovement`) and the planner re-plans the commit, which runs after
  the last answer. Exact away/toward and a movement with one legal square never pause.
  `RANDOM` (SPELLS-33.T6k2a, D159; the Air Elemental's Whirlwind) is rolled once per plan: `interpretForcedMovements` draws
  one of the eight `SQUARE_GRID_COMPASS_RAYS` and the room walks it with `traceSquareGridForcedMovementRay`, the same trace
  away/toward use. It never owes a pick (`upTo` is forced off), so no held area outlives its roll, and it stops short only
  when blocked. The trace returns what ended each walk (`DISTANCE`, `OBJECT`, or the creature in the way), from which
  `landForcedMovements` builds the per-mover landing report: feet travelled, `stoppedBy` (`NONE`, `OBJECT` or the struck
  creature's actor ID) and the rolled ray. A mover stops in the last free square before a creature; movers land farthest
  first, each against the Scene after the earlier landings. The report rides the commit (`forcedMovementLandings`) and
  is recorded on the `RESOLVE_ACTION` command beside the Scene moves undo reverts. The walk is unrelated to the T6k1
  passage walker, which validates a mover's own path through hostile footprints rather than a forced line. The
  collision's mover damage (T6k2b3, D159) settles in the area commit: each mover that travelled 10 ft or more takes
  `floor(feet/10)` times the authored dice as an unsaved damage action of the pusher (`collisionDamageCapability`), one
  more ordinal entry after the caught creatures' (`kept`), skipped while a pick is still owed. A RANDOM ray is rolled
  once and sealed in `context.forcedMovement.rays` when a pick is first held; a replan reuses it. The Air Elemental's
  Whirlwind authors this block (the closed `CREATURE_AIR_ELEMENTAL_WHIRLWIND_COLLISION` kind is gone).
  The struck creature's save (T6k2b4b, D159) is a second AREA_PENDING hold opened after the movers land
  (`holdEncounterAreaCollisionSaves`): one entry per strike, appended to `context.targets` with a `collision` marker
  (mover, dice, damage type, ability, DC, condition) and its own occurrence id (`encounterCollisionSaveOccurrenceId`).
  Struck entries are not caught: they stay out of the caught checksum, GM removal and the root `sealed` list, and the
  struck creature rolls its own save (a creature's is server-rolled). A failed save takes the mover's dice times
  `floor(feet/10)` plus the authored condition; kept order is caught, movers, struck. Legendary Resistance is the
  generic offer, matched to a creature's first undecided entry.
  The authored `collision` block on `FORCED_MOVEMENT` (dice per 10 ft, a fixed-DC struck
  creature save, a condition) rides the proposal as canonical JSON in a `collision` TEXT port (empty for none), is
  echoed by `interpretSpatial` and reaches `LiveSessionForcedMovement.collision`; a
  collision the System cannot settle (non-fixed-DC save, bonuses, non-UUID id, bad dice) fails closed.
  It fails closed on a non-square grid and on a path through a spatial effect (`collectSpatialMovementCandidates` non-empty). Undo is the
  action's (see persistence, Scene command evidence). Not yet: fog derivation, concealment pruning and grapple breaking on a forced move;
  legendary and reaction actions still refuse spatial directives; an area pick after a GM removal, on an area with no
  aggregate snapshot, or for a creature moved twice fails closed (future-enhancements, Deferred edge cases).
- **Disengage** is an `APPLY_GRANT` on SELF for one `TURN` with an `OPPORTUNITY_ATTACK_IMMUNITY` modifier of the flag kind `ENABLE`
  (empty domain, no payload), anchored to the holder's `END_OF_TURN`. The room reads it with `encounterGrantsEnabledDomain(effects, 'OPPORTUNITY_ATTACK_IMMUNITY')`.
  A `TURN` duration counts the turn in progress (`includesCurrentTurn`, no own-turn +1); `ROUND` and longer keep the +1. Like every
  grant it ends only at a real turn end (START or ADVANCE_TURN); GM cursor corrections do not tick grants (product-owner ruling, ATTACK-18.2).
- **Two-weapon fighting damage (ATTACK-9.T5b, D-pending-attack-9-t5)** adds no feature-specific kind. The damage ability modifier of an
  off-hand bonus attack is the existing `min`/`max` clamp on `resolveAbilityModifierBonus` (`max: 0` keeps a modifier only while negative,
  `min: 0` only while positive; the optional finesse kind accepts the same fields), and the `ATTACK_ACTIVATION` facet predicate (folded to
  `ITEM_ACTIVATION`, read from `Dnd5eModifierTarget.activation`) lets one weapon's damage grant differ between its Action and bonus-action
  attacks. The Two-Weapon Fighting style (Fighter, Ranger, Champion) is a pair of GLOBAL melee-damage `min: 0` grants, one per ability,
  gated on a Light weapon, the bonus action and that attack ability (`twoWeaponFightingGrants`); there is no closed rule.
  ATTACK-9.T5c authors the weapons: `withOffHandAttack` and `withOffHandDamage` (shared equipment builders) give each SRD Light melee
  weapon a `BONUS_ACTION` melee attack gated by the `ATTACK_ACTION_OTHER_WEAPON` requirement and split its melee damage ability
  modifier into an Action grant (`ATTACK_ACTIVATION` EXCLUDE) and a `max: 0` bonus-action grant (INCLUDE). Item attack choices carry
  `actionCost`, so the offer names which activation each attack uses.
- **Rage (ATTACK-9.T1, D113)** is authored data on the compiled path, with no Barbarian executor: a bonus action that spends the
  `rageCharge` binding and applies a 1-minute SELF grant. Four generic shapes carry it. (1) An attack records the ability it used
  (`usedAttackAbility`: the highest ability modifier of the attacking item's own `SOURCE`-scoped modifiers, so a finesse weapon records
  the chosen one and a Character-wide ability bonus from another source adds to the roll without changing the ability) and the `ATTACK_ABILITY` facet predicate gates a modifier on it, so
  Rage's damage bonus applies to Strength weapon attacks only; level steps are three `CLASS_LEVEL`-gated fixed bonuses. (2) A grant is
  state-bound by two lifecycle fields: the end event `ON_INCAPACITATED` in `recurrence.endOnEvents` (grants only; the turn-effect
  kernel still rejects it) and `recurrence.endOnConditionIds`, the Conditions that end it (Rage names Unconscious, the SRD's "knocked
  unconscious", so Stunned or Paralyzed keep it). A grant that ends on `ON_INCAPACITATED` also ends when its holder is defeated. The holder-end option
  `recurrence.holderEnd` `{ activation }` lets the holder end the grant at that activation cost. These are found by the D95 detection
  point (`encounterConcentrationEndReason` via `planNativeLiveConcentration`; `grantsEndedByHolderState` picks the grants),
  which returns `endedGrants` beside `concentrationEnds`; the commit validates and deletes them, and a `RESOLVE_ACTION` root keeps
  them in `consumedGrants` so GM undo restores them. `holderEnd` lets the Character's own player end that grant (in an Encounter through the end-grant command, which spends its
  activation; outside one through `END_ACTIVE_EFFECT`/`endCharacterActiveEffect` for a FREE end; every other effect stays Campaign-owner-only, D99). (3) The `SPELLCASTING_LOCK`
  `ENABLE` domain bars every spell cast (`spellcastingLocked` on the action model, reason `SPELLCASTING_LOCKED`), ends the holder's
  Concentration when the grant arrives (end reason `SPELLCASTING_LOCKED`), and `prepareEncounterActionMaintenance` refuses a new
  Concentration with an `EncounterValidationError`. An actor or Sheet edit ends the grant through `endConcentrationAfterEdit`, and damage taken during a
  movement pass (opportunity attack, hazard) through `endHolderStateGrants`, which `persistMovementSettlements` calls for each Run
  actor after its settlement steps have committed (the movement planner does not plan the end, so it lands after the pass, not between
  contacts). Both read the committed holder state (`readHolderEndState`), delete the grants and post a chat notice per grant
  (`postGrantEndMessages`), as the action and turn commits do. A commit that omits a grant its damaged holder's state ends is refused
  ("grant end is missing"); the planner and persistence share one end rule (`grantsEndedByHolderState`). Rage's heavy-armor restriction is an `EXCLUDE`
  `EQUIPMENT_EQUIPPED` condition (category `ARMOR`, property `HEAVY`) on each Rage benefit's facets, the same predicate Monk's Unarmored
  Movement uses. A Rage that ends Concentration (`SPELLCASTING_LOCKED`) adds a Concentration-end child that undo cannot restore, so GM
  undo of that action is refused with that reason (a full restore is a proposed follow-up).
  **Idle turns (ATTACK-9.T6b, SRD Rage "ends early").** The end event `ON_IDLE_TURN` ends a grant at the end of its holder's turn
  unless the holder was engaged since their previous turn. The mark is `idleTurnMark` in the actor's free-form `resources`
  (`encounterActorIdleTurnMark` / `withEncounterActorIdleTurnMark`), hashed in the actor state checksum so it replays with the Run.
  It is tri-state: absent for an actor that holds no idle-bound grant, `ARMED` while it holds one and has not engaged, `ENGAGED` once
  it has. The armed marker is what keeps the damage path free of reads: only a marked actor ever has its effects listed. A grant
  created by an action effect (`persistEncounterActionEffects` through `armIdleTurnActor`) arms its holder, or marks it `ENGAGED` when
  the holder is the current turn actor, so the first check is the end of its next turn (a lenient, recorded deviation from SRD 5.1 on
  every activation path). Engaged means an attack roll (d20 result `ON_HIT`/`ON_MISS`/`ON_CRIT`) against a hostile creature
  (`attackedHostileCreature`) or damage after reductions, and every such site marks through the one `engageIdleTurnActor`:
  action commits, opportunity attacks, Disarm, Grapple and Shove, spell and area attack rolls, reaction attacks, the damage choke
  point, Sheet HP decreases and GM HP edits. `planIdleTurnCheck`, run by `persistEncounterIdleTurnCheck` at the end of the turn commit,
  after the outgoing turn's Legendary Action damage so that damage counts, ends the idle-bound grants of an `ARMED` holder and clears
  its mark, and arms an `ENGAGED` one again. Skipped-turn ticks run no check for an actor that had no turn. GM undo restores the marks
  an action changed (`idleTurnMarkChanges` on the `RESOLVE_ACTION` root, diffed before and after the commit); Disarm, GM HP edits,
  Sheet HP changes and movement reactions are not undoable. A mark left by a grant that ended another way is reconciled at the next
  END_OF_TURN.
- **Gone with slice B:** the mechanic codes `SPEED_MOVEMENT_BONUS` and `NO_OPPORTUNITY_ATTACKS`, `suppressesEncounterOpportunityAttacks`,
  the `speedMovementBonus` DTO field and `speedBonusTurn` on `USE_BASIC_ACTION`.
- **Gone with slice D:** `USE_BASIC_ACTION`, `UseEncounterBasicActionInputDto`, the catalogue `check` and `mechanics`
  fields, `STABILIZE_TARGET` and `BASIC_ACTION_MECHANIC_CODE`, and `nativeBasicAction.ts` (slice E's deletions, pulled forward).
  Undo restores the actor row exactly: a returned allowance of zero removes its `ruleUsage` entry rather than writing `0`.
- **Restrictions (slice E).** An actor is offered a basic action, and may take it, only when its facet `restrictions` hold; no
  restriction means every actor, Characters and Creatures alike. The check is `encounterBasicActionRestrictionsHold`
  (`encounterBasicActionRestrictions.ts`): it normalizes the facet with the grant-fold restriction normalizer and decides the holder-state
  predicates (`CAN_ACT`, `SPEED_ABOVE_ZERO`, `FREE_HAND`, `TURN_MOVEMENT`) against `EncounterHolderState` (`encounterHolderDefense.ts`), the same live
  decision grant restrictions use; any other predicate fails closed. Each CHARACTER or CREATURE context also normalizes to a
  `HOLDER_KIND` condition on its subject, and a CREATURE context's `CREATURE_TYPE` to a `CREATURE_TYPE` condition (D152): the
  Encounter decides both from the holder's `kind` and `creatureTypeIds`, the Character fold decides them as constants (a Character
  holder, no creature type), so its outputs are unchanged, and item-action requirements always see a Character. `FREE_HAND` is true
  while more hands are empty than creatures the holder holds with a `SOURCE_OCCUPIES_HAND` relationship (`encounterSourceHandHolds`,
  read from every Run actor's active effects) and reads `resolveHandOccupancy` (D107): a Creature's hands come from its equipment
  loadout snapshot, a Character's from the `handFacts` rule input (`characterHandRuleFacts.ts`, built from the equipped slots and the
  TWO_HANDED property). The capability descriptor carries the
  document's `restrictions`. The choices read (`actionChoiceReads.ts`) drops actions whose restrictions do not hold, and the Session Worker
  (`refuseUnmetBasicActionRestrictions`, after `prepareEncounterActionMechanics`) refuses an unmet one as `SOURCE_REQUIREMENTS_NOT_MET`
  before anything is planned. A homebrew copy of the catalogue keeps its `restrictions`, since they are part of the document.
- **Gone with slice E:** nothing further; the closed basic-action codes were all deleted by slices A to D (verified by search).
- **Gone with slice A:** `withEncounterBasicActionDefense`, the `dodgeContributors` plumbing, the Dodge Run-resource effect kinds,
  the mechanic codes `DISADVANTAGE_ON_ATTACKS_AGAINST` and `SAVE_ADVANTAGE`, `saveAbilityIds` and
  `suspendedWhileUnableToActOrMove`.
- **Storage.** A reusable definition's document is stored as canonical JSON text (`documentJson`, `definitionDocumentJson.ts`): an
  authored action's effects nest deeper than Convex's 16-level value limit (Dodge is 19 deep), as ADR 0029 already does for authored
  versions. Readers and checksums still see the typed document.

### Spell casting in an Encounter (current, SPELLS-8.T1)

A Character casts a spell through `RESOLVE_ACTION` like a Feature action. The choice is built from the same
`spellCastCandidates` entry the Sheet and the initiative declarations read (`characterSpellCastActions.ts`):
one action choice per offered candidate, so upcasting is choosing the higher-level candidate and the command
has no cast-level field. The action id is `spell-cast:<uuid v5 of the candidate id>`, a fixed length however
long the candidate id grows. The choices travel beside the Character's other actions as
`characterSpellCast` on the Encounter source facts (`encounterMovementTargets.ts`), so the Sheet's own
actions and the movement reactions never see spells. Attack reactions do read them (a spell with a REACTION
activation and an attack or damage trigger is offered like a Feature reaction).

A candidate is offered through the Sheet's own logic, not a copy of it: the spell must come from an active
source (`isActiveSpellSource`: prepared per preparing class, learned for the others, always prepared and
granted spells included) and the candidate must be one of the cast levels the Sheet lists
(`getSpellCastLevels`): the spell's own level, plus every higher level for which the Character owns a slot
(standard or Pact Magic) when the spell reads its cast level. A spell reads it when its authored effects scale by
it (damage or healing `SPELL_CAST_LEVEL` scaling, a `SPELL_CAST_LEVEL` target count, a granted amount of
`SPELL_SLOT_LEVEL`) anywhere in the Effect, including follow-up save/check branches and manifest behaviors, components and proximity rules or compare with it (`CANCEL_TRIGGERING_EVENT`, Counterspell's slot-versus-spell check).
`effectReadsSpellCastLevel` derives that flag from the compiled Effects into `readsCastLevel` on the spell's
action facts and reference mechanics; nothing names a spell. Any other spell is cast at its own level only.
A Warlock's pact slot also pays a cast at the spell's own level and is spent whatever its level. A candidate is
dropped when its decision is not `AVAILABLE` or it is a ritual. A leveled cast paid from a spell-source pool (`LIMITED_USE`, or a `FIXED_LEVEL` grant with `charges`,
SPELLS-8.T8) carries a `resourceUse` of one use of that pool and spends no slot, as on the Sheet
(`sheetResourceUsage.ts`); a cantrip is free, and so is a `FIXED_LEVEL` grant without charges. The pool spend
is the ordinary `resourceBinding` of the compiled entry and GM undo restores it by the pool's owner key. A
`CAST_AT_LEVEL` grant casts at its `castAtLevel` even when it is also `LIMITED_USE`. The Worker does not offer
an attack reaction whose prepared state spends a pool, because the reaction receipt carries no pool spend. A spell is offered only with exactly one active
Effect (a PASSIVE Effect is ignored): one cast is one action and the compiler executes one Effect group per
action. A cast is offered only when the System adapter compiles its entry (`COMPILED`), since choosing one that
stays `MANUAL` could only be refused as stale. The dnd5e Effect-action compiler does not yet execute a group that
needs several entries, so those are not offered. A heal that scales per cast level selects its dice row at compile
time: `healDiceConfiguration` reads the entry point's `spellCastLevel` and picks the row with `selectScalingRow`
(`scalingRowSelection.ts`), the one selector the compiler and the Sheet's `selectValue` share, so the published
graph rolls that many dice (a heal's dice count is structural, unlike a damage upcast, which specializes an
outcome graph from the bound `dnd5e.spell-cast-level` fact). The selector takes rows keyed by a minimum value of
a bound level fact, so a class-level key reuses it. A heal that targets several chosen creatures (Mass Cure
Wounds, Mass Healing Word, Prayer of Healing) is offered with the list target above. Labels read "Cure Wounds (2nd level)"; a cantrip reads its name.

The cast level is a fact of the action. `prepareNativeCharacterActionState` copies the policy's `castLevel`
onto the action mechanic as `spellCastLevel`, the dnd5e adapter binds it as the declared fact
`dnd5e.spell-cast-level` (a Game System `factContracts` entry), and the
authored scaling reads it (`dndScalingFactsFromRuleValues`), for damage and non-damage spells alike. Each
spell compiles once per document (`activeSpellEffects`).

The slot is spent in the same Character version as the outcome. `prepareNativeCharacterActionState` returns
`spellConsumption` (`characterId`, `spellId`, `candidateId`, `slotKey`, `beforeUsed`, `afterUsed`) for the slot
the decision names (`readSpellCastSlot`), and none in Manual automation. The batch plan writes
`state.spellSlots` through the Sheet's `updateSpellSlotUsage` and refuses a stale spend (`Encounter Character
spell slot consumption is stale.`), and the receipt carries it as `spellCastConsumption` (batch for a single
target, the area root for a point area, once). `REVERT_LAST_ACTION` restores the slot through the same
function, and only while the Character's Sheet stream is unchanged since the cast (a later Sheet write makes
the undo unavailable, like any Character state change). A Concentration spell starts Concentration through
`prepareEncounterActionMaintenance` (D99), so the undo restore rules there apply. Components, hands and
silence have no Sheet rule yet, so an Encounter applies none either.

### Ending a held effect and its `onEnd` grant (current, SPELLS-4.T2l-a)

`deleteCas` and `deleteMaintainedStateCas` (`encounter-persistence/effectStore.ts`) are the one place a held effect leaves encounter state, in the Convex path and the room alike. Each takes a required `removal`: `ENDED` (expiry, Concentration drop or replacement, early end, consumption, a departing source) or `REMOVED` (undo, an actor's own removal, Run completion). An `ENDED` effect whose definition carries a `MODIFIER_GRANT` `onEnd` template leaves its follow-on grant on the same holder (Haste's lethargy, `rules-runtime/encounterEffectOnEnd.ts`): a holder-anchored timed grant with an id derived from the ended effect's, created inside the tick pass so it is not ticked in the same pass. Restoring the effect (`create` with `restoredFrom`) takes that follow-on back.

### Granted-action offers (current, SPELLS-4.T2lb, D160)

A held effect's result block may carry `lifecycle.grantedActions` (generic authored data: `activation`, optional `usesPerTurn`, optional `weaponAttack`, `actionDefinitionIds` of BASIC_ACTIONs; never a spell name). The compiler stores it on the `MODIFIER_GRANT` contribution (`grantedActions`); `encounterGrantedActions.ts` reads it back from the holder's current effects (`heldGrantedActions`). The `onEnd` follow-on never inherits it.

- **Id form:** `<basic action id>:GRANTED:<activeEffectId>:<offerIndex>` (`grantedActionId` / `parseGrantedActionId`). The basic-action prefix check still holds, so clients echo `choice.id` unchanged.
- **Resolve-time re-check:** `resolveEncounterActionSource` takes a `granted` input (held effects plus this turn's spent keys) and refuses a stale offer (effect ended, no longer offers that action) or a spent one. A source carries the offer's `activation` in place of the action's own, and `grantedUseKey`.
- **Allowance:** a `FREE` offer skips the allowance in `evaluateNativeLiveActionEconomy`; any other activation spends the real allowance. A `weaponAttack` offer is the Attack action's fallback when its own economy is unavailable: the attack opens a total-1 Attack action charged to the offer's use key.
- **Use count:** a capped offer spends `granted:<effectId>:<offerIndex>:<use>` in the turn row's `usedOncePerTurn` (see persistence.md); the commit spends it and an undo restores it.

### Effect offers: moving a held effect (current, SPELLS-4.T2d2, D160)

`grantedActions` offer a basic action to the effect's holder; `lifecycle.effectOffers` is the second offer family, made to the effect's **source** (or holder) about the effect itself. Generic authored data, never a spell name: `{ kind: 'MOVE_HELD_EFFECT', offeredTo: 'SOURCE' | 'HOLDER', when: 'HOLDER_AT_ZERO_HP', activation (not REACTION or FREE), range { amount, unit } }`, at most 4, `APPLY_GRANT` only. The compiler stores it on the `MODIFIER_GRANT` contribution (`effectOffers`); the `onEnd` follow-on never inherits it. A later kind (T2lb2's `REPEAT_SOURCE_PATH`) is one more `kind` in `packages/schema/src/effects/effectOffer.ts`; discovery, the listing and the pick envelope do not change.

- **Discovery (pure, `encounterEffectOffers.ts`):** `effectOffersFor` finds the offers an actor is made by scanning the Run's effects by holder (effects are indexed by holder, not source, so the read is every actor's effects: actors x `MAX_ACTIVE_RULE_EFFECTS_PER_OWNER`, `readActiveEffectsByActorId`). `liveEffectOffers` keeps those whose `when` holds on the holder (`zeroHitPointActorIds`); `resolveEffectOffer` is the stale-offer check the pick and the commit both run.
- **Zero hit points, not defeated:** `HOLDER_AT_ZERO_HP` reads 0 current hit points (`readZeroHitPointActorIds` in Convex; the holder's movement target in the room). A dying Character at 0 is at 0 but not defeated, and its holder's mark is offered; a defeated creature is at 0 too. The new holder must not be defeated and not the old holder.
- **Listing:** `effectOffers[]` on the action choices response (`effectId`, `offerIndex`, `kind`, `holderActorId`, `activation`, `range`, `warnings` of the offer's activation).
- **Pick:** `MOVE_HELD_EFFECT` (`planNativeLiveMoveHeldEffect`): current actor, controlled, no pending occurrence; a stale offer is refused `SOURCE_REQUIREMENTS_NOT_MET`, a defeated or old-holder target `TARGET_UNAVAILABLE`. The new holder is held to the offer's range by `evaluateEncounterActionTargetPolicy` over `effectOfferTargetPolicy(range)` (any single creature within the distance; warnings, including `TARGET_RANGE_UNCHECKED` without a Scene, are acknowledged like the activation's through `spendNativeHolderActivation`'s `extraWarnings`).
- **Commit:** `persistEncounterMoveHeldEffect` re-derives the offer from the stored effect and the Run's hit points (the room's plan is trusted only for economy and warnings), `deleteCas` with `removal: 'REMOVED'` (no `onEnd` follow-on, maintained state untouched), then `create` with the same id, definition, lifecycle (remaining ticks) and `maintainedEffectStateId` under the new owner. `requireDefinitionOwner` checks only ENCOUNTER-scope provenance, so a different owner in the same Encounter is accepted; the per-owner effect cap and the Concentration dependent cap are re-checked by `create`.

#### Repeat offers: `REPEAT_SOURCE_PATH` (current, SPELLS-4.T2lb2a, D166)

The second `lifecycle.effectOffers` kind lets the effect's **source** repeat one of the spell's paths on the effect's holder (Heat Metal's repeated damage) without recasting.

- **Authoring:** `{ kind: 'REPEAT_SOURCE_PATH', activation, pathIds, effect }`. The compiler keeps only the offer's `pathIds` in a copy of the authored Effect and sets its invocation activation to the offer's; the stored copy reuses `effectDtoSchema` (no parallel shape). Heat Metal authors it on a **carrier** path (`repeatCarrierPath`): an item-bound `APPLY_GRANT` with no modifiers that ends on `ON_CHOSEN_ITEM_RELEASED`, lasts the Concentration and is a maintained dependent of it. The 1-round disadvantage grant is unchanged.
- **Frozen at cast:** `frozenRepeatOffer` (`encounterActionEffectPlans.ts`) rewrites the stored offer's save to `FIXED_DC` with the DC the cast settled (`d20.defenseOrDc`) and records the cast level as a sibling `castLevel` (D166 words it as converted rows; a sibling lets the compiler's own scaling rows select, with no second scaling path). The repeat therefore never reads the caster's stats or slots as they stand later.
- **Action source:** `REPEAT_PATH` (`encounterRepeatPathAction.ts`), id `<actorId>:REPEAT_PATH:<carrierEffectId>:<offerIndex>`. `resolveEncounterActionSource` resolves it from the holder's live effects and compiles the offer's frozen Effect (`compileEffect` then `bindEncounterEffect`); a missing carrier or offer is stale. `featureActionMechanic` supplies `spellCastLevel`, the activation and `save.dc`, so the repeat runs the normal capability pipeline: no slot, no new Concentration.
- **No new pending arm:** the repeat is an ordinary `RESOLVE_ACTION`; its `ENCOUNTER_ACTION` pending replays the command and the repeat id re-resolves from live effects at each replay.
- **Pick:** `effectOffers` lists it (`kind: 'REPEAT_SOURCE_PATH'`, `actionId`); the client starts that action id. `nativeEncounterRules` refuses a target other than the holder (`TARGET_UNAVAILABLE`). The web repeat row is not built yet (see the handoff).
- **Held or worn:** `encounterItemInstanceIdsOnActor` is now "held in hand or worn", so a carrier bound to worn armor outlasts a drop that cannot happen. `isSupportedTestActivation` allows a `BONUS_ACTION` saving throw (a repeat's charge).
- **Node maps:** `LOCAL_COLLECTION` sources take `up` (ancestors, nearest first) so the offer's `pathIds` select from the path list several groups up.

Initiative is application policy over typed rules evidence. Campaign settings select an allowed
UUID-backed policy and tie resolver for future Encounters; admission freezes the exact policy and graph
documents (System v3/v4 defaults, or a Campaign override whose sources the Campaign's Rules Catalogues
enable) with one snapshot checksum. A System without a default and a Campaign without an override
produce no automatic policy, and the Run uses an explicit `MANUAL` round. Optional-combat settings use the
same current-selection, frozen-run boundary with a separate checksummed snapshot; see
[D&D optional combat](dnd5e-optional-combat.md).

A policy document selects a procedure (`ACTOR_ROLL`, `ACTOR_SCORE`, `SIDE_ROLL`, `DECLARED_ACTION_ROLL`)
and cadence (`ENCOUNTER_START` carries the settled order into later rounds, `EACH_ROUND` evaluates a
fresh round), and pins an evaluation graph, a bounded order-choice graph and bounded tie resolvers.
Graphs supply facts and scores; the application orders results and invokes the pinned resolver.
Unresolved ties go through the order-choice graph, never an application tiebreak.

Lifecycle order: `START` creates a `PREPARING` round, evaluates the policy, resolves ties and choices,
activates the first participant, then enters that actor's `START_OF_TURN`. At an `EACH_ROUND` wrap the
outgoing `END_OF_TURN` settles before the next round is evaluated. While evidence or a choice is pending,
the root command keeps one Encounter occurrence at an unchanged version. Every preterminal phase
(outgoing effects, the proposed round, incoming Recharge, the incoming Character's death save) stays non-mutating until the terminal commit
re-validates and applies it atomically, so a pause leaves aggregate state unchanged. One Campaign has at
most one `ACTIVE` Encounter Run.

Reordering applies after any pending decision resolves. A newly improvised actor acts in the current round
only if its rolled position is after the current actor; preplanned hidden actors already occupy the order.
Modules: `encounterInitiative*` (graph execution, score batches, tie and order resolution, staging,
state settlement), `encounterTurn*`, `encounterRechargeLifecycle`. The room's ordering and delivery are in
[live sessions](live-sessions.md).

## Effective maximum hit points

Effective maximum hit points is one computation (`character/hitPointMaximumReductions`) that subtracts a
Character's active reductions, never below 0. Encounter Character targets, the Sheet projection and the
rest preview all use it. Hit points clamp to the reduced maximum. The Character row's stored
`maximumHitPoints` is the maximum before reductions; row readers subtract reductions through
`characterMaximumHitPoints` in `packages/encounter-persistence`. A reduction's `recoveryTags`
(`schema/effects/hitPointMaximumReduction`) always include `RESTORE_HIT_POINT_MAXIMUM` and may add
`LONG_REST`; a long `COMPLETE_REST` deletes the latter. The contribution freezes `sourceLabel` and
`sourceHidden`; only the GM's Sheet view shows a hidden source's label
(`projectCharacterSheetForViewer`). A Creature at a 0 maximum has 0 hit points and is defeated; a
Character only drops to unconscious.

## Portable live preparation

`rules-runtime/character/builderPreparation` and `character/sheetPreparation` own reconciliation,
readiness and Character evaluation over authorized inputs. `character/contextPreparation`
(`prepareCharacterRuleContext`) owns source selection, retained Equipment handling, inheritance
resolution, feature collection and the Spell catalogue decision, over injected typed readers.
`prepareCharacterRuleSources` compiles sources once for repeated evaluation; `evaluateCharacterRules`
accepts it only with the same immutable context object.

**Builder catalogue.** `assembleCharacterBuilderContext` builds the catalogue in `selectors` or
`resolution` scope. Its readers return each pool's picker facts in the content snapshot index shape (ADR
0036), a subrace already joined to its base Race. `selectors` takes `CharacterBuilderCatalogueReaders`
(every picker pool) and is the browser's, via `character/snapshotReaders` (`createSnapshotReaders`,
`createLazySnapshotReaders`) over the parsed snapshot objects of one Character's manifest, where a `SOURCE`
root shadows a Campaign share of the same root. `resolution` takes only
`CharacterBuilderResolutionCatalogueReaders` (Classes, Equipment, Feats) and serves the server's Sheet,
assignment and source-loss paths through `characters/builderContext`.
`assembleCharacterReferencedBuilderContext` serves the Convex Builder commit from referenced current
publications. `character/builderPayload` (`resolveCharacterBuilderPayload`) turns a context into the
Builder payload, and `character/snapshotBuilderEvaluation` wraps that over snapshot readers.
`characters/builderSnapshotParity.test.ts` proves the snapshot payload equals a full-pool evaluation.

**Room.** The room receives stored Character, Sheet, Campaign and Run inputs through `room-inputs` on
hydration; authored content comes from the room's verified content snapshot objects through
`createSnapshotReaders` (`roomContentSnapshots`, `nativeCharacterRules`). The `liveSessionCharacterRules`
contract shapes the Character rules scope. Source access remains the Character owner's, and Convex does not
evaluate Character rules for live play. The room uses the same context, Builder catalogue and Sheet
preparation functions, without serializing database contexts or Maps.

**Encounter preparation.** `encounterMovementTargets` owns target facts, effect reductions and reaction
source compilation; `encounterMechanicsBatchPlan` owns the Character/actor transition plan;
`encounterActionSources` and `encounterActionMechanicsPreparation` own action source resolution and
target, resource, relationship and execution-plan preparation; `encounterActionEffects` and
`encounterActionEconomy` own effect planning and allowance calculation (no reads for Manual mode or
actions without an allowance); `encounterCreatureEquipmentSources` owns Equipment snapshot pinning and
loadout binding checks. The room reads actors, effects and definitions through its read ports and commits
through its write ports (`roomEncounterReadPorts`, `roomEncounterWritePorts`). Convex adapters that
still call these modules authorize their reads first.

**Other pure helpers.** Sheet commands and projection (`sheetCommandReducer`, `sheetRest`, `sheetRoll`,
`sheetPanel`, `sheetProjection`), spell eligibility, `campaignClock` boundaries and the shared
1,000-character resource pool key bound live under `character/` and the package root. Authentication,
randomness, history and atomic consumption stay with the caller. See [character](character.md) for Sheet
and Builder ownership.

## D&D 2014 adapter

D&D 2014 supplies policy for abilities, skills, attacks, saves, damage, conditions, spellcasting,
Concentration, reactions, initiative, legendary and recharge behavior, and approved optional combat
settings, all outside the Kernel. The checked-in SRD must compile through the same contracts as homebrew,
and every mechanics-bearing path is classified Automatic, Assisted or explicit Manual/Judgment.

`platformRulesRuntime` supplies the installed capabilities and operations to execution and publication.
The focused `platformEncounterPolicy` and `platformCharacterPolicy` bindings use the same D&D policies and
System UUID without initializing the rest. `evaluateInstalledEncounterActors` and
`evaluateInstalledCharacterPolicy` select the System by UUID, validate schema facts and results, and
reject unknown Systems. Whole-policy composition resolves spell access before the grant fold, then
modifiers and derived stats, defenses, movement and senses, vitals, spell mechanics, slots and resources,
actions, eligibility and rest. Policy modules are looked up through `platformPolicyModules`; unsupported
policy keys and contract versions are rejected.

**Modifiers and combat math.** `systems/dnd5e/modifierApplicability` is the one scope rule: a `GLOBAL`
modifier applies Character-wide, a `SOURCE` modifier only while its own source is evaluated, narrowed by
Equipment and Spell facets. Restrictions the fold cannot evaluate fail closed. `systems/dnd5e/attackKind`
classifies `MELEE | RANGED | UNARMED | MELEE_SPELL | RANGED_SPELL`; `dnd5eAttackRollContributors` adds an
action's own contributors to the Character-wide `rollContributorEvidence`. Armor class uses one
calculation (best of worn armor, unarmored, or an authored formula; a shield and flat bonuses add).
Creature `qualifiedDamageDefenses` apply only to attacks lacking every bypassing trait. Modifier kinds
without a consumer are rejected at grant validation (see [authoring schema](authoring-schema.md)).

**Creature loadout replacement and the printed attack.** A Creature Feature action binds to its loadout Equipment by attack kind (`triggerCode`) alone: the Feature's own print governs the bound attack's damage and damage type, so a Creature printed with a different damage type than its Equipment's default (the Ogre Zombie's bludgeoning Morningstar) still runs. `replaceActorEquipment` keeps that binding honest: the replacement must keep the attack kind the Feature acts through and, for an entry a Feature action is bound to, the damage types of the Equipment it replaces (`equipmentReplacementKeepsDamageTypes`), so a piercing weapon swaps for another piercing one and a bludgeoning weapon is refused.

**Creature equipment hands (D107).** A Creature's authored `equipmentLoadout` places each item in
`MAIN_HAND`, `OFF_HAND`, `CARRIED` or `WORN` (`EQUIPMENT_SLOT_CODES`, `packages/shared` core). One
function, `resolveHandOccupancy`, decides hand legality for the schema (two items in one hand), the
shared compiler, Creature publication (`apps/apis/convex/content/creatureLoadoutHands.ts`), Encounter
admission (`pinCreatureEquipmentSources`) and the GM's per-instance `replaceActorEquipment`, which
also read the Equipment's `TWO_HANDED` property because a two-handed main-hand item blocks the off
hand and a two-handed item cannot sit in the off hand. Disarm moves an item from either hand to
`CARRIED` and records the hand in the transition's `fromState`. ATTACK-18 and ATTACK-19 reuse the
function for Characters.

**Creature Equipment pins (D163).** Each Encounter Creature's `equipmentSources[]` pin holds a copy of the
Equipment version's stored `subject-compiler-v2` compilation (resolved, variant parents applied). The room,
blueprint snapshots and `creatureLoadoutHands` hydrate it with `hydrateStoredCompilation` and never compile;
`encounters/equipmentPinMigration` (steps of `content/compilationMigration:run`) re-pins older rows.

**Default attack (ATTACK-19, D107).** `encounterDefaultAttackActionId` (`encounterDefaultAttack.ts`)
picks the action the tabletop drawer starts on, reported as `defaultActionId` in the action choices
(`readEncounterActionChoices`): the open Attack action's last weapon while it still has an attack
left, otherwise the available `ACTION` weapon attack bound to the main-hand item, otherwise the
available `BONUS_ACTION` weapon attack bound to the off-hand item. Hands come from
`encounterActorHeldItems` (a Character's equipped items, a Creature's loadout) through
`resolveHandOccupancy`; an action is bound by its Character item instance or Creature loadout entry.
The off-hand damage and its Two-Weapon Fighting restore stay the `withOffHandDamage` clamp above; the
drawer only reads the default and never derives it.

**Character equipment hands (SHEET-8, D107).** `state.equipment.equipped` is
`{ itemId, slot: MAIN_HAND | OFF_HAND | WORN }[]`; an unequipped item is carried. `nextEquipSlot`,
`swapHeldItems` and `promotesOffHandItem` (`packages/shared` core, beside `resolveHandOccupancy`) are the
only assignment rules: the Sheet reducer (`EQUIP_ITEM`, `SWAP_HELD_ITEMS`, `UNEQUIP_ITEM`) and the web
optimistic projection both call them. Held categories are WEAPON and SHIELD; the rest is worn. Only the
Sheet unequip promotes an off-hand weapon into an emptied main hand; `unequipCharacterItem`, shield stow and
Disarm only empty the slot, and the stow undo finds the exact entry by the recorded equipment checksum. In
the rule snapshot `EquippedState` is `{ slot }`. Armor class counts armor only when `WORN` and a shield
only in a hand; with two held shields the one with the best total (base plus its own applied modifiers)
counts, the main hand winning a tie. `encounterWieldConflict` picks the same shield.

**Drawn weapons (user ruling, 2026-09-24).** A used Character action on a carried weapon treats it as
drawn unless its equipment facts say `requiresEquipped`; the grant fold applies the same rule to
Source-scoped `ATTACK_ROLL` and `DAMAGE` grants. Armor and shield still use real equipped state.
`encounterWieldConflict` returns `STOW_SHIELD` when a `TWO_HANDED` action meets an equipped shield, via
`resolveDnd5eShieldArmorClass`. A `RESOLVE_ACTION` is `PROMPTED`: the submitter must send
`acceptedWieldConflict` naming exactly the evaluated shield; the stow joins the source Character's batch
(`stowEquippedItemInstanceId`) and the receipt records `sourceItemUseStateTransition`. Initiative
declarations, movement reactions, Legendary Actions, Cleaving and Disarm are `UNPROMPTED`. Player-driven
action submission, which would move the prompt to the player, is not built.

**Weapon draw (ATTACK-19.T2, D107).** A directly resolved attack (`PROMPTED`) whose bound weapon is
carried draws it into a free hand for no action; declared, reactive and follow-up attacks never do.
`evaluateEncounterWeaponDraw` (`encounterWeaponDraw`) decides from `planHandDraw` (`packages/shared`
core): `DRAW` into the hand `nextEquipSlot` picks, `RELEASE_REQUIRED` when only held creatures
(`SOURCE_OCCUPIES_HAND` holds, `handHolds` on the `PROMPTED` acceptance) keep both hands from the weapon,
and `NONE` for a natural attack, a weapon already in hand, or hands full of items (swapping stays free).
A Character's attack is bound by its action equipment; a Creature's only through a loadout binding, so
natural attacks draw nothing. The draw composes with the shield stow in one Character stream version
(stow first, then draw, each with its own equipment checksum) and travels as `drawHeldItem` on the
source's equipment mutation, `sourceItemDraw` on the batch output and receipt
(`CHARACTER_ITEM_DRAW` / `ENCOUNTER_ACTOR_ITEM_DRAW`, the Creature draw being the loadout `CARRIED`
-> hand `useState` change). Undo reverses the draw before the stow and refuses when the hand moved on.
With no free hand because of holds, `RELEASE_REQUIRED` raises `HandReleaseRequiredError`. The
action-choices read marks the action `handRelease: { holds }` (the releasable hand holds) so the attack
flow asks "release which?", sends the existing `RELEASE_RELATIONSHIP`, then the attack; a released hold
is not restored by undo. The read cannot see target-dependent refusals, so it offers the release
whenever the listed action would need one; the planner refusal stays as the backstop.

**Thrown weapon (ATTACK-19.T3, D107).** A ranged attack through a `THROWN` weapon that is in a hand
leaves that hand: `evaluateEncounterWeaponDraw` returns `THROW { itemId, slot }` (the weapon's
`thrown` flag is `attackKind === 'RANGED'` and the `THROWN` property, read from the authored data, never
a named weapon). A carried thrown weapon is `NONE` (no hand is needed, so never `RELEASE_REQUIRED`), and
a melee attack with the same weapon moves nothing. The throw reuses the draw seam end to end:
`throwHeldItem` on the source's equipment mutation and the same `sourceItemDraw` receipt transition
with `movement: 'THROW'` (default `'DRAW'`). A Character's throw unequips the item (after any shield
stow); a Creature's moves the loadout entry hand -> `CARRIED`. Undo re-equips it to the hand it left,
refusing when the equipment moved on. Disarm already empties the disarmed item's hand
(`itemReleaseTransition`), and swapping weapons stays free (`encounterWieldConflict`).

**Action phases.** An authored action compiles to an immutable template; after the owner locks and
authorizes facts, at most two ordered phases specialize from it: `TEST` (one d20 stage selecting the hit,
miss, critical or save path) and `OUTCOME` (exact authored dice and scaling). Each phase is acyclic with
one evidence stage; resource use, mutations and receipts wait for the terminal phase.
`diceGraphDefinition` is the only place that doubles critical dice.

**On-hit riders (D119).** A passive Feature's trigger-matched direct `ON_HIT` outcomes (damage, and since
ATTACK-7.T5 any other outcome, such as a forced movement) merge into the
weapon action's compiled effect when `buildCharacterActionRuleFacts` builds the action
(`character/characterOnHitRiders`), so the rider is one more part of the same hit: resistance and critical
doubling apply unchanged. A rider with `usesTriggeringWeaponDamageType` takes the damage type of the attack's
first `ON_HIT` damage; an unmerged one fails closed. A rider whose dice grow with class level lists `CLASS_LEVEL`
rows with a `classId`; `bindFacts` supplies the actor's class levels (`dnd5e.class-levels`) and
`exactDiceConfiguration` picks the highest row at or below that level. It is the shared row selector that
other level-keyed dice (T12) reuse. A Character's riders are collected from class, subclass, race and feat
Features only. A Creature's attack takes the riders of its own passive Features through the same collect, merge
and `reduceEffectRestrictions` path in `encounterFeatureActionCapabilityDiscovery` (SPELLS-33.T3a5), with no
Equipment facts, so a rider's weapon checks never hold. An Effect that still carries a `CLOSED_RULE` outcome
contributes no rider, since its gate or remainder would be lost (D156).
A path restriction's `DAMAGE_TYPE` check on the `EQUIPMENT` subject ("an attack that deals bludgeoning
damage") is settled with the weapon checks in `reduceEffectRestrictions`, against the types of the hit's
`ON_HIT` damage that no restriction, use limit or player choice withholds.
`ADD_BONUS_DIE` stays non-executable.

**Optional on-hit riders (D123, current).** A rider authored with `optionalOnHit: { kind: 'SPELL_SLOT' }` on a
passive weapon-attack invocation is merged into the weapon's compiled effect like any rider but stamped
`optionalRider`, and the OUTCOME specialization keeps it only when its effect id is in the bound fact
`dnd5e.selected-optional-riders`; its level-keyed rows read the paid slot from `dnd5e.spell-cast-level`
(`selectScalingRow` clamps above the authored rows, which is how Divine Smite caps at 5d8). After a hit, and after
any `REACTION` pause has resolved, the attacker's riders it can still pay for hold the occurrence with a sealed
`ON_HIT` pause (`ON_HIT_CHOICE` summary, the attacker's controller answers per D19). Option 0 is a decline; each other option pins
a rider and the way it is paid: a slot level (`SPELL_SLOT`) or a resource pool and its cost (`RESOURCE_POOL`, authored as
`optionalOnHit: { kind: 'RESOURCE_POOL', chargeId, cost }`, offered only while exactly one resolved pool carries
`chargeId` and holds `cost`). The use option id hashes the hit and the way of paying, so a changed pool or cost is stale. Answering rebuilds the OUTCOME under the chosen binding (`onHitOutcomeBinding`); the slot
spend (or, for a pool, the `resourceConsumption` that `spendCharacterResource` also builds for an action's own
`resourceUse`) rides in the attack's own character-mechanics batch with a spell-less receipt (`spellId` and `candidateId`
are null together), so GM undo restores it. Nothing names a feature: the SRD Divine Smite and Improved Divine
Smite (`source-data/srd/classes/paladin`) are authored from core options only. Improved Divine Smite has no
`optionalOnHit`, so it is a mandatory rider.

**Path restrictions (D119).** An Effect path may carry `restrictions`, a facet (OR-ed groups of AND-ed
conditions) that gates whether its result is owed. The compiler copies it onto each entry. Two stages settle it:
`buildCharacterActionRuleFacts` resolves the weapon checks (`EQUIPMENT` contexts: `EQUIPMENT_PROPERTY`, item
identity, through the same `dnd5eItemRequirementsMet` the Rage restrictions use) against the attacking item and
leaves only circumstance checks, `ATTACK_ROLL_MODE`, `ENEMY_NEAR_TARGET`, `MOVED_TOWARD_TARGET` and (against a `CREATURE` context) `CREATURE_TYPE` (`reduceEffectRestrictions`, `systems/dnd5e/attackRestrictions`); an entry
that can never be owed is dropped, one whose group has nothing left to decide is unrestricted. The attack's roll
mode is known only after the d20, so `specializeDnd5eEffectActionOutcomeBody` filters the remaining
restricted groups then (`attackRestrictionsMet`). It reads the mode the TEST d20 was settled in (D124): the
evidence `rollMode`, which `resolveEncounterActionPhaseExecution` passes to the adapter as `testRollMode`, not
the mode the rules derived from roll contributors. A hand-rolled advantage unlocks the rider, a flattened
derived advantage forgoes it, and a sight-governed d20 (D100) settles in the true mode, so the check follows that.
A `CREATURE_TYPE` check reads the target's creature type from `dnd5e.target-creature-type`, which the attack
TEST binds from the target's derived facts (a `CREATURE` context is `authoringModeKind: ALL` or `SELECTED` over
`creatureTypeIds`). The sealed OUTCOME template checksum hashes the authored groups, restricted or not,
so it is the same whichever the roll owes; the published graph is what differs. Only `EQUIPMENT`- and `CREATURE`-context
checks are evaluated; any other subject fails its group. A path whose every group is restricted away
produces no OUTCOME graph, which the phase resolver rejects for a template that exists (see Deferred
edge cases in `docs/roadmap/future-enhancements.md`).

**Enemy near the target (D119 e).** `ENEMY_NEAR_TARGET {feet}` is the second circumstance check: another
creature hostile to the target, able to act (not defeated, not incapacitated), within `feet` of the target,
measured by `measureSceneTokenFootprintDistance` between the target's token and the candidate's and converted
to feet (`encounterEnemyProximity`, `nearestAbleEnemyProximity`). The attacker and the target never count;
a NEUTRAL actor is never hostile. `prepareEncounterActionMechanics` asks its optional `loadEnemyProximity`
supplier only for an attack whose compiled Effect reads the predicate (`effectReadsEnemyProximity`), and puts
the answer in the binding's `sourceDerivedFacts.attackEnemyProximity`; `bindFacts` emits it as the TEXT fact
`dnd5e.attack-enemy-proximity` (`{"nearestFeet": number | null}`). An attack without the fact (no Scene
context, or a path that supplies no loader) leaves the check unanswerable, so
the group fails whether the constraint is INCLUDE or EXCLUDE. The Session Worker's supplier
(`nativeAttackEnemyProximity`) re-reads the locked Scene through `ACTION_AREA_SCENE` and loads every actor it
consults through `loadTarget`, so the room's existing fences are what refuse a mismatch: the capture refuses a
moved Scene version (`Action Scene context is stale.`) while planning, the commit's read fence covers the
consulted actors' revisions and the Encounter version, and the currentness and bound-facts checksums over the
binding refuse a resumed paused attack whose fact changed. The capture reads every bound actor's token, so an
unavailable token refuses the attack, as for an area action. Persistence never
re-runs rules (ADR 0035); this is the room-authoritative reading of "persistence re-verifies". A movement
opportunity attack supplies the same fact: the Session Worker places the mover at the contact point of its
planned path and measures the Scene with the same helper (`measureNativeEnemyProximity`).

**Moved toward the target (D164).** `MOVED_TOWARD_TARGET {minFeet}` is the third circumstance check, the
printed Charge gate ("moves at least N feet straight toward a target and then hits it on the same turn"). It
passes when the attacker's latest voluntary move this turn closed at least `minFeet` between its start and
end positions and the target's token (`movedTowardTarget`, `encounterMoveToward`): distance(start, target) -
distance(end, target). No heading or path is stored. The D38 `encounterTurnMovements` row keeps that move as
`lastMove` `{start, end}` beside `usedFeet`; each voluntary move replaces it, and forced movement or a teleport
clears it (`recordTurnLastMove`, `clearTurnLastMove`). A `lastMove.end` that is not the attacker's current token
position (undo, a drag) answers 0 closed feet. `loadMoveToward` (supplied only for an Effect that reads the
predicate, `effectReadsMoveToward`) binds the TEXT fact `dnd5e.attack-move-toward` (`{"closedFeet": number}`);
without it (no Scene, or a reaction or opportunity attack, which have no turn record) the group fails whichever
the constraint. The Session Worker reads the record through the `TURN_LAST_MOVE` capture. A move published in
segments records only its last segment.

**Once per turn (D119 f).** `usage: ONCE_PER_TURN` on a path limits it to one hit per turn of any creature
(Sneak Attack can land on a reaction). The usage key is the compiled effect id for a path in the attack's own
Effect and the Feature id for a passive Feature rider merged onto the attack (`oncePerTurnUsageKey`; a
compiled Effect has one entry per scaling row, so keys are deduplicated). The record is the D38 row
`encounterTurnMovements`, keyed (Encounter, round, turn actor, actor), extended with `usedOncePerTurn`
(sorted key ids); there is no second table. `loadTurnUses` (`encounterActionMechanicsPreparation`) reads it
only for an attack whose Effect reads it (`effectReadsTurnUses`), and `bindFacts` emits it as the
`dnd5e.attack-turn-uses` TEXT fact; `pathOwed` refuses a limited entry whose key is spent. After the roll
`spentTurnUses` derives the spent keys from the final evidence `sourceEntryBindings`. The commit writes
them in the same transaction (`spendTurnUses`; spending an already spent key throws), the command record keeps
`turnUses {round, turnActorId, keys}`, a replayed command returns the stored result before any spend (so it
never spends twice), and `REVERT_LAST_ACTION` gives them back (`restoreTurnUses`). A movement opportunity attack carries `turnUses` on
its reaction settlement and spends them for the reactor. ATTACK-9.T6 reads the same row. Character on-hit
riders merge only onto equipment-sourced attacks (`collectOnHitRiders`), so a Feature-sourced attack, such as
a creature-style Bite Feature, gets no rider.

The immediate follow-up save shapes the
adapter supports, ranged long range (`longAmount`, `encounterActionLongRangeContributor`), reach 0 swarm
attacks, timed conditions (one effect owning several conditions and, beside them, a speed grant:
`conditionContributions` and the plan-level `lifecycle`, SPELLS-27.T9) and multi-condition hits are defined by the compiler
(`systems/dnd5e/effectActionCompiler`) and fail closed outside those shapes. Range and reach use one
measure, `measureSceneTokenFootprintDistance`. The SRD attack sweep allowlist
(`__tests__/srdCreatureAttackSweepAllowlist.ts`) lists the attacks that remain unsupported, each with one
reason, and may only shrink. Versatile grips author one effect per grip.

**Hit point maximum reduction (SPELLS-33.T3a4).** A `HIT_POINT_MAXIMUM_REDUCTION` whose `DAMAGE_TAKEN`
amount names a damage outcome of its own result path compiles on a direct test path too, not only in an
immediate follow-up save's failure: each path's OUTCOME graph gets one reduction proposal bound to that
path's damage proposal. The proposal carries the path that authorizes it (`authorizedPath`: `ON_SAVE_FAIL`
for a nested save, the selected path for a direct one), and interpretation reduces the maximum by the
damage the target took. SRD Succubus/Incubus Draining Kiss authors it on both save paths.

**Legendary and Recharge.** Policy lives in `dnd5e-encounter-lifecycle` documents; usage state stays with
Feature-owned charge identities. Recharge runs for the incoming actor in the shared turn occurrence.
At each `END_OF_OTHER_ACTOR_TURN` boundary the occurrence freezes a UUID-sorted owner queue; each eligible
owner gets at most one window, and the turn resumes after the queue is terminal
(`encounterTurnLegendaryDiscovery`, `discoverTurnLegendaryWindows`). A Feature option may run another
action Feature of the same Creature through `actionReference: { featureId, chargeCost }`. An option may
also create active effects (a `FREE` activation with a Feature charge, e.g. Unicorn Shimmering Shield, may
target any creature including its owner under D99). `execute()` prepares the effects plan before the
mechanics plan, records the created effects on the EXECUTED evidence (`createdEffects`, an opaque record
array parsed with `activeRuleEffectRecordSchema` at use) and `persistEncounterTurnResources` stores them
through `persistEncounterActionEffects` in the turn commit. Range is not enforced here: discovery has no
Scene geometry, so every actor the policy allows is offered.

**Grant lifetimes (D99).** A timed `APPLY_GRANT` of modifiers compiles to a `MODIFIER_GRANT` active
effect (`modifierGrantPlan`). Its authored `lifecycle.turnAnchor` names whose turn counts it down and at
which boundary (`TARGET`, i.e. the holder, at `END_OF_TURN` when absent); the plan carries it as its
`tickAnchor` and the stored expiration's `anchor`/`decrementStage`. A grant made on its
anchor actor's own turn with an `END_OF_TURN` boundary counts one more turn, so "until the end of its next
turn" outlasts the current one. The longest authorable duration is `MAX_ACTIVE_EFFECT_TURNS` (14,400 turns,
24 hours; SPELLS-4.T2a3, D156), exported from `packages/schema/src/shared/activeRuleEffectLifecycle.ts`; the compiler
leaves a longer duration MANUAL and never clamps it. The stored tick fields (`expiration.initialRemaining`,
`lifecycle.remainingTicks`, the grant listing) allow `MAX_ACTIVE_EFFECT_STORED_TICKS`, one more, for that extra
own-turn tick. Grants are stored with `recurrenceStage: 'NONE'`, so the turn-effect kernel
never selects them. A timed condition with a `SOURCE` turn anchor (Color Spray's blindness, "until the end of
the caster's next turn") is stored and counted the same way, extra turn included; the kernel counts other timed
conditions on the holder's turns. `planEncounterGrantTicks` (`encounterGrantLifetimes`) counts down or expires every
such effect anchored to the boundary actor, whoever holds it, and an expired one releases the conditions it alone held, and `persistEncounterGrantTicks` writes it in the turn
commit's transaction. A grant's `consumeOnFirstEvents` (`ON_ATTACK_ROLL`, `ON_ABILITY_CHECK`) lists the events that use it up: it is deleted by its holder's next
attack-roll action (not a save action) or ability check and stored on the command as `consumedGrants`, which GM undo
restores (`discoverEncounterEventHooks`, `consumedGrantPersistence` in encounter-persistence). Help is the
grant that carries both events. **Movement-bound end events (SPELLS-31.T5n):** `recurrence.endOnEvents` also takes `ON_MOVE` and `ON_TAKE_ACTION` (qualifier-free; `endOnTriggers` keeps qualified events). `ON_TAKE_ACTION` ends with `actionEndedEffects` on any action the holder takes, read from the effects held before it, so the action that creates the effect does not end it. `ON_MOVE` ends with the holder's voluntary movement: the evaluator's terminal result carries `moveEnds`, the command settles a `MOVE_END` settlement (`persistLiveMovementMoveEnd`), forced movement and teleports do not end it. The facet predicate `TURN_MOVEMENT` (`maxFeet` or `maxSpeedFraction`) is a holder-state predicate decided from `EncounterHolderState.turnMovement`, filled by the `TURN_MOVED_FEET` capture over `encounterTurnMovements.usedFeet`. **Ability checks (SPELLS-4.T2c2, D156):** `ABILITY_CHECK` takes `ADD_BONUS_DIE` (Guidance). A check raises a `TEST` event with its ability (`{ kind: 'TEST', test: 'CHECK', ability: { code } }`), which spends only the effects whose ability-check grant applied to that ability; a bare check (`ability: null`, a contest's) spends none that hold such a die. The Sheet adds and spends a carried die in `evaluateCharacterRoll` (`carriedTestDice`). **D20 floor (SPELLS-4.T2c3, D156):** `MINIMUM_ROLL` on `ABILITY_CHECK` (a payload `amount` of 2 to 20; Glibness) floors the d20 a check counts. It is automatic: the roller replaces only a lower face, so the option needs no choice. `activeAbilityCheckMinimumRoll` reads the highest floor the holder's effects give an ability (an ungated grant covers every check; the lowest effect id breaks a tie), and `ContestFacts.minimumRoll`, the Sheet's `carriedTestDice` and the roll records take it from there. The kernel graph still outputs the raw die: `d20CheckTotal` applies the floor to the kept face (which commutes with advantage and disadvantage) beside the modifier and added dice, so every site shares one total and `selectedNatural` stays the face kept. The floor is not spent. Reliable Talent stays `CLASS_ROGUE_RELIABLE_TALENT` (SPELLS-31.T5c): the option expresses its floor of 10, but its "proficient check" narrowing is not yet a grant condition. **Saving throws (SPELLS-4.T2c2b, D156):** `ON_SAVING_THROW` is the same scoped test over `SAVING_THROW_MODIFIER` grants (Resistance, any ability; a death save has `ability: { code: null }` and spends an unfiltered die). `savingThrowSpentEffects` (`encounterEndedEffectRelease`) is the one spend rule: `targetEndedEffects` calls it for the saves an action settled (the d20 evidence names the save's `savingThrowAbilityDefinitionId`, set where the compiler builds the save policy), the Concentration plan and its persistence call it for the Constitution check, the turn-start death save and the Sheet's `carriedTestDice` call it with their own ability. Persistence re-derives the spent set and refuses a plan that omits or adds a die. **Attacked (SPELLS-4.T2a3, D156):** `ON_ATTACKED` uses a grant up on the first attack
roll made against its holder, hit or miss (Guiding Bolt's mark). The roll reads the grant's modifiers first; the target's
`targetEndedEffects` (`attacked`, the action's `makesAttackRoll`) then ends it with the target's damage-ended effects, once
each, on the same receipt (`consumedGrants`, so GM undo restores it). Every attack root passes it: the action, an area or
chosen-creature attack (once per creature, however many rays name it), the movement reaction attack and the Legendary window;
turn effects pass `false`. **Event scope (SPELLS-4.T2k1, D156):** `effectEventScope` (`events/encounterEventHooks`) is the one
home of whose events an effect meets and on whose turn: only its Encounter source's when the lifecycle sets
`fromSourceOnly`, and only during its tick anchor's turn while one tick remains when it sets `activeOnlyOnFinalAnchorTurn`
(null while dormant, or source-only with no source in the Run). The `ATTACKS_AGAINST` contributors carry it and the attack
filters them by attacker and current turn actor; `targetEndedEffects` (`turnActorId`) consumes an `ON_ATTACKED` effect only
within it. True Strike is authored with both; Hunter's Mark and Hex can reuse the same scope for their damage. First Aid and Escape consume at the first commit, so their pending check context freezes the used grants as `consumedGrants` and the pending read names them from it. A Creature's check grants resolve the check's governing ability from the System skill (`checkAbilityCode`). Every
attack path consumes: ordinary actions, movement reaction attacks and Disarm record `consumedGrants` on
their command, and a Legendary Action window deletes its owner's grants at the turn commit when the option
rolled an attack (`attackRoll` on the EXECUTED evidence); only ordinary actions have GM undo. A
grant made at another creature's turn end has no extra tick and ends at the end of the holder's next turn.
An event that ends a condition-owning effect (Invisibility on its holder's attack roll, SPELLS-27.T2, D125) also releases the condition: the planner adds `CONDITION_REMOVE` to the action's source batch (`sourceApplications`, required on both mechanics batch receipts; `endedEffectReleases`), and the root receipt's `endedMaintainedStates` and `restoredConditionIds` give the Concentration and the condition back on GM undo, fenced by the source stream version. Every attack-roll or cast root calls `actionEndedEffects` (`makesAttackRoll`, `castsSpell`; discovery takes several events and ends an effect once): the action, the movement opportunity attack (applied in `liveMovementReactionPersistence`), the Legendary window (applied in `persistEncounterTurnResources` from the evidence's `attackRoll` and `castsSpell`) and Disarm (a required `sourceApplications` on the `CONTESTED_ACTION` output, applied before settlement from the initiator's held effects); only the action has GM undo. **Cast (SPELLS-27.T3):** `ON_CAST_SPELL` is raised when the source's prepared action casts a spell (`preparedCastsSpell`: a Character's spell or cantrip, or a Creature or Legendary action triggered by a spell attack; only Character casts have a counter level, `preparedSpellCastLevel`). The release rides the batch that carries the caster's own spend: the target batch when the caster is the target (the releases come first), else the source batch (`sourceApplications`). An area or chosen-creature cast carries it on the area root's `sourceApplications` (or on the caster's child batch when the caster is caught), and a countered cast on its root; both roots and their commit inputs also carry `consumedGrants`, so the effects end in the same transaction and GM undo gives them back (`restoreReleasedConditions`). **Reactor casts (SPELLS-27.T3b):** a reaction that casts a spell ends the reactor's own cast-ended effects too. A Shield-style reaction (the reactor is the host action's target) puts its releases on the host's target batch (`targetReleases`) and its grants in the host's `consumedGrants`; a Counterspell puts them on the reactor's spend and records them in the countered root's required `counter.applications`, restored by GM undo with the reactor's slot. `NON_RELEASING_EFFECT_EVENTS` keeps authoring from listing an event whose consumer does not release.

A structured end trigger (`recurrence.endOnTriggers`, SPELLS-27.T4) ends an effect on an event that needs a qualifier. Today the one event is `DAMAGE_TAKEN` with `by` (`ANYONE` or `SOURCE_SIDE`, the effect source and its allies) and the same damage-type filter the reaction trigger uses (`damageTypeFilterDtoSchema`). `targetEndedEffects` reads the action's `DAMAGE` applications on the holder (`resolvedAmount > 0`) and returns the ended effects and their condition releases; the single-action path passes the releases to the holder's batch after the outcome (`damageReleases`, beside the Shield-style `targetReleases` that go first) and the effects through `consumedGrants`, so GM undo restores both by receipt: `actionRevert` gives back the target's `CONDITION_REMOVE` applications named `active-effect.ended` (`restoreReleasedConditions`) and refuses (`REVERT_UNAVAILABLE`) any other removed condition. Only the timed-condition plan can author a trigger.

SPELLS-27.T4b wires every other damage root and adds the actions that end an effect against an enemy. `{ event: 'ATTACK_ROLL' | 'SPELL_CAST', against: 'ENEMY' }` joins `endOnTriggers` (Sanctuary): `actionEndedEffects` takes a required `againstEnemy` (`actsAgainstEnemy`: any target in a `HOSTILE` relationship to the actor, never `NEUTRAL`) and ends the holder's effect when the action makes an attack roll, or casts a spell (the T3 cast fact), against an enemy; an ally or a neutral target ends nothing. `targetEndedEffects` is called by the area commit (per target, deduped across a creature named twice; `consumedGrants` carries the ended effects, so GM undo restores them), the Legendary window (the planner computes it; `turnResourcesPersistence` recomputes it from live effects and refuses a stored receipt that lacks a planned release), the movement reaction (the mover's ended effects ride the REACTION step's `consumedGrants`) and turn effects (`turnEffectDamageEnded`: an execution's own damage ends the holder's other effects, a later candidate of the same turn expires at its own execution, an earlier one is not ended retroactively; the releases are `active-effect.ended` `CONDITION_REMOVE` applications on that execution, which `turnEffectsPersistence` recomputes and deletes the effects for). Death-save damage is an ordinary `DAMAGE` application folded by `encounterCharacterMechanicsBatch`, so the roots above already cover it. Legendary, movement reaction and turn effects have no GM undo, so they are proved without it.

**Effect-owned temporary hit points (SPELLS-4.T2t, D156).** A Character's `hitpoints.tempSourceEffectId` and a Run actor's `tempHitPointsSourceEffectId` name the active effect whose grant set the temporary hit point pool. Both are optional and absent whenever no effect holds the pool, so stored records need no backfill. One rule home, `schema/shared/temporaryHitPoints` (`temporaryHitPointsAfterGrant`, `AfterLoss`, `AfterRelease`, `AfterEffectsEnd`, `Set`, written through `withCharacterTemporaryHitPoints` and `withActorTemporaryHitPoints`), serves the Encounter mechanics fold, the turn-effect executions, the Sheet reducer, rests and GM undo: a bigger grant replaces the pool and its source, an equal or smaller one is ignored, damage keeps the source until the pool is empty, and a manual Sheet edit (`SET_HIT_POINTS`) clears it. A form's origin keeps its amount but not its source. An effect whose definition carries the `TEMPORARY_HIT_POINTS_OWNERSHIP` state contribution stamps `sourceActiveEffectId` on the `TEMPORARY_HIT_POINTS` applications it makes (`withOwnedTemporaryHitPoints`): the Worker stamps the cast batch with the effect id it mints before settlement, and the target-bound executor stamps each recurring execution. The three existing end paths release the pool beside the owned conditions with a `TEMPORARY_HIT_POINTS_RELEASE` application, which empties it only while that effect is still its source: event ends (`endedEffectReleases`), turn-boundary expiry (`expiredEffectReleases`), and the end of maintenance such as Concentration (`settleCharacterEndedEffects`, `planEncounterMaintenanceOwner`, by the removed effect ids).

**Sequential composition (SPELLS-4.T2t, D156).** The dnd5e compiler accepts one cast of two or more DIRECT `SEQUENTIAL` `ON_USE` entries that share target, test, duration and maintenance, holding at most one grant, at most one recurring entry and at most one immediate heal, as one active effect (`sequentialComposition`). The immediate heal, else the grant, compiles as the cast graph. A recurring entry accepts minute and hour durations, does not fire at cast (`recurrenceDeferred`) and builds its own graph; a `FIXED` recurring heal can add ability modifiers, settled at cast into the `dnd5e.recurring-heal-amount` fact, which `castFactKeys` copies from the cast evidence into the effect's adapter facts. A plan with `ownsTemporaryHitPoints` gives its effect the ownership contribution. The compiled active-effect plan carries all three fields as optional (`characterMechanics`), absent on every other plan. Heroism, Enhance Ability (one `CHOICE` option holding a grant beside temporary hit points) and Regenerate compile this way.
SPELLS-27.T12 adds `{ event: 'ACTION_USED_ON_HOLDER', actionDefinitionIds }` (Sleep, authored with the SRD Rouse basic action): `actionUsedOnHolderEndedEffects` ends, on the target of a basic action another creature uses, the effects whose trigger names that action's definition, and releases the conditions only they held in the target's own mechanics batch, beside the damage ends in the same receipt. Only the single-target action path (`nativeEncounterRules`) consumes it today; the area, legendary, movement-reaction and turn-resource paths do not.
SPELLS-33.T4c adds `{ event: 'INCAPACITATED', of: 'SOURCE' }` (Knight Leadership): the effect ends on every holder when its Encounter source is incapacitated or defeated, which is the source's Concentration end reason, not the holder's `ON_INCAPACITATED` event. `grantsEndedBySourceState` selects the grants (`sourceBoundGrants` lists the candidates). `planNativeConcentration` plans them beside the holder-state ends in `endedGrants`, from each changed actor's reason, so they commit with the source's incapacitation under the same revert fence. `persistEncounterConcentrationChildren` re-derives the source's reason from committed state, refuses a sent grant it does not end, and refuses a commit that omits a grant of a damaged source whose committed reason is INCAPACITATED or DEFEATED. No index answers "which grants did this actor apply", so the scan of holders (one list each) runs only on the commit that drops a creature, never on ordinary damage. The trigger needs an Encounter origin with a source actor.
An `ARMOR_CLASS` grant on a Creature raises its AC through `withCreatureActiveGrantArmorClass`, applied
where movement targets and Cleaving facts are built. A fixed `SKILL_MODIFIER` grant (Pass without
Trace's +10 Stealth) raises that skill's stat block total through `withCreatureActiveGrantSkillTotal`,
which `actorContestFacts` applies to every Creature skill check and passive it freezes (Hide, Search,
contests, escapes). A
SOURCE-anchored grant ends when its source is removed from the Run (`planDepartedSourceGrantRemovals`,
applied in `cleanupRemovedActorEffects` and listed in `removedEffects`). A skipped (defeated or
absent (`absence`) actor's turn still ticks both boundaries in the turn commit that skips it, so a
Character removed from an active Run, which only leaves initiative (D82), has its SOURCE grants end
through its skipped turns.

**Departure (D128, SPELLS-28.T1).** A TELEPORT outcome with an off-Scene destination (`LINKED_LOCATION` or
`SPECIAL`) compiles to a target-only `dnd5e.depart-proposal`. Its `DEPART` application sets the chosen actor's
`absence` to `DEPARTED` (any Run actor kind) in the action commit; revert restores it by the before-state. The
skip set and the Tabletop stage read `absence`, so initiative skips the actor and its bound token is hidden
without a Scene write. The GM clears it with `UPDATE_ACTOR returnToInitiative`. Spatial occupancy and targeting of
an absent token are not modeled (a defeated token behaves the same). In-Scene destinations are T1b.

**Carry-over (D99 Q1 A, SPELLS-5.9).** COMPLETE ends the effects a Run sourced on its Characters
(`endCompletedRunCharacterEffects`: Encounter-scoped grants), alongside the Creature effects ADR 0035
Amendment 30 drops. A Character's own (`OWNER`-scoped) timed grants outlast the Run, and so does a
Concentration grant the Character holds (SPELLS-5.7): COMPLETE detaches it from the Run's maintained state
(`detachMaintainedCas` nulls `maintainedEffectStateId` and `sourceEncounterId`) and stamps
`lifecycle.concentrationCasterCharacterId` with the caster's Character id (`null` for a Creature caster).
`planCarriedOverEffects` keeps the stamp. Then: `planCarriedOverEffects` turns each remaining count into `lifecycle.expiresAtCampaignMinute`, the
Campaign clock's absolute minute at completion plus 6 seconds per remaining round rounded up to whole
minutes, with `remainingTicks: null` so later Runs never tick it. Without a Campaign clock the grant gets no
expiry and lasts until the GM ends it. A timed condition-owning effect on a Character (Hold Person's
Paralyzed, Invisibility) is carried the same way (SPELLS-5.14): its plan takes the target's lifetime scope
like a grant's, `planCarriedOverEffects` selects it, and the turn-effect kernel skips it once it carries
an expiry (`isTurnEffectEligible`). A Creature's condition effect keeps `ENCOUNTER` scope and ends with the
Run. The condition leaves the Character's Sheet when the carried effect ends: the GM-only
`END_ACTIVE_EFFECT` and the caster's `END_CONCENTRATION` Sheet commands strip the conditions only the ended
effects held (`endedMaintenanceConditions`), and the Concentration-caster end paths reach the same helper
through `reconcileNativeMaintenanceOwners`. `expiredCarriedOverGrants` lists the grants a clock minute has
reached. The room has no Campaign clock, so Convex converts them (see
[persistence](persistence.md#encounter-run-storage)). Advancing the Campaign clock ends the carried grants
it reaches on Characters that are not fighting, through the GM-only `END_ACTIVE_EFFECT` Sheet command;
a fighting Character's are checked on the next advance.

**Resume in a later Run (D151, SPELLS-5.13).** A Run's START resumes its Characters' carried effects in the
START's own transaction, before the opening turn is planned (`persistCarriedEffectResumes`, called by the
room's `executeRoomEncounterTurn`). Only a `PREPARED` Run resumes, so a replayed START changes nothing.
The room reads the clock through the `CAMPAIGN_CLOCK` room input, and only when an effect carries an
expiry. `planResumedCarriedEffects` gives each carried `TICKS` grant or condition-owning effect
`remainingTicks = min(initialRemaining, (expiresAtCampaignMinute - now) x 10)` and drops the expiry, so
the turn kernels count it again from the next turn boundary; a result of zero or less ends it like an
expired grant. A grant carried with no expiry (no clock at completion) stays untimed, and no clock now
resumes nothing. A carried grant's `SOURCE` anchor names an actor of the earlier Run, so it counts on its
holder's turns instead (`grantAnchorActorId`), and the departed-source removal skips it. Tick writes
spread the stored lifecycle, so the caster stamp survives every count. Not resumed: a Character that joins
an already `ACTIVE` Run, and a carried effect held only through a worn form.

**Reinstated Concentration (D151, SPELLS-5.12).** After the resume, the same START gives a carried caster
who is a Character actor of the Run back the Concentration their surviving carried grants are stamped
with. `planReinstatedConcentrations` groups the Run's Character-owned, unlinked, stamped effects by caster,
keeps the casters in the Run, and builds one maintained-state descriptor each from the System
Concentration definition (`requireInstalledConcentrationMaintenanceDefinitionId`, read only when a caster
reinstates) with `provenance: { kind: 'CARRIED', casterCharacterId }`. `persistCarriedEffectResumes`
creates the state on the caster's actor and relinks each grant (`relinkCarriedCas`), so damage stages a
Concentration check and every loss path (failed check, incapacitation, edit or chosen end) ends the grants
as dependents through `applyLiveConcentrationCleanup`, which also records the caster in
`concentrationCasterCharacterIds` when the ended state is `CARRIED`. At COMPLETE the relinked grants carry
over again through the usual detach. A turn effect under a `CARRIED` state binds by its caster stamp, not
its origin (`requireTurnMaintainedStates`). An `ACTION` provenance names the creating action and
occurrence; the receipt's `priorState` names neither (its checksum pins the prior descriptor). Not
reinstated: a caster whose stamped grants all sit on Characters outside the Run.

**Listing and ending (D99 Q2 A, SPELLS-5.8).** `listActiveGrantListings` lists a holder's grants (label,
whether the source was hidden, rounds left or the carried expiry minute, and its polarity);
`hideActiveGrantSources` nulls a hidden source's label for everyone but the GM and keeps the polarity (D110).
Polarity is BENEFICIAL or HARMFUL only when every piece of the grant reads that way for its holder, otherwise
NEUTRAL; it is derived from the frozen modifiers and senses, never authored, and the VTT status ring colours by it. Encounter actors carry them as `activeGrants`
(none on a COMPLETED Run, which reads no effects), shown on the token, the turn tracker and the drawer; the
Sheet overview carries them too. The Campaign owner ends one by hand: a Character's through
`END_ACTIVE_EFFECT` (gated on Campaign ownership, not on the Sheet viewer, so it works on the GM's own
Character per D92; a maintained grant is refused, end its Concentration instead) and a Creature's through
`UPDATE_ACTOR.endActiveEffectId`. Ending a grant has no GM undo.

**Hit grants and reactions (D99).** An attack's `ON_HIT` or `ON_CRIT` `APPLY_GRANT` stays out of the
two-phase TEST/OUTCOME graphs, like an on-hit relationship: `modifierGrantPlan` makes it the attack's one
active-effect plan (more than one hit grant, or a grant beside a relationship, is unsupported) and records
`dnd5e.grant-authored-path`, and `prepareRecurringActiveEffect` applies it only when the TEST's result path
reaches that path (a critical hit reaches both). A TEST/OUTCOME action accepts grant plans only. A
`REACTION_COUNT SET_VALUE 0` grant suppresses the reaction-allowance capability
(`encounterActiveGrantCapabilitySuppressions`, read by `resolveEncounterRuleCapabilityStates` beside
relationship suppressions), so its holder is offered no movement reaction while the grant lasts.

**Granted extra Actions (ATTACK-9.3).** Action Surge is a core-authored free self action that spends its
charge and applies a `TURN` / `END_OF_TURN` `ACTION_COUNT SET_VALUE {amount: 2}` grant. The System's ACTION
binding names `grantedCountDomain: 'ACTION_COUNT'`, and `resolveActionAllowance` takes
`max(allowance usage.maximum, activeSetValueGrantMaximum(holder effects, 'ACTION_COUNT'))`, so the economy
offers exactly one more Action while the grant lasts. `SET_VALUE` is idempotent: a second Surge on the same
turn adds no third Action. The next turn's refresh may reset a `used` above the base maximum
(`turnResourcesPersistence` validates the equality of `encounterRuleUsageUsed`, not an upper bound).

**Actor links (D129, SPELLS-28.T3).** A `TELEPATHIC_LINK` outcome compiles to `dnd5e.actor-link-proposal`
and an `actorLinkContribution` on the active-effect plan (link kind, outcome id, Intelligence floor, duration
counted at the end of the target's turn). The plan has no members of its own: the chosen-creature commit
(`completeAreaCommit`) supplies the creatures the cast reached, and `prepareEncounterActionEffectPlans` writes
one `ACTOR_LINK` state contribution (members sorted) per target, or none when fewer than two were reached. The
effects are persisted per child in `areaCommitPersistence.ts` and deleted with it on revert. The contribution
has no gameplay effect; it is provenance that ends at the duration.

**Creature forms (D130, SPELLS-28.T2).** A `MANIFEST` / `CREATURE` outcome with `forms` compiles to
`dnd5e.creature-form-proposal` and a `creatureFormContribution` on the active-effect plan (forms with a per-form
`maxTargets`, the duration, `excessDamageCarriesOver`). The chosen target is `{ kind: 'ACTORS', actorIds, formId }`;
the room (`readChosenFormCreature`) refuses a missing form, a Character and more creatures than the form allows, and
reads the form Creature (the Worker through `LiveCaptureReads.readFormCreature`, persistence re-reading the created
effect's `creatureId`, both via `actorFormEntry`). `enterActorForm` swaps the form's snapshot, `sourceId`,
`sourceRevision` and hit points into the actor and keeps the origin in `form`; `revertActorForm` is the one,
idempotent way back. A form ends when its hit points reach 0 (the pure plan in `planEncounterMechanicsBatch`, the
excess carried per `excessDamageCarriesOver`), when its effect is deleted (the `effectStore` delete hook reverts the
actor: duration end, dismissal), and on cast undo (`actionRevert` deletes the form effect before it restores hit
points). `writeRunActor` deletes the form effect of an actor that has left its form. The origin snapshot is kept by
checksum (`formOriginSnapshotChecksum`); `form` is required and nullable, and `actorFormMigration` migrates dev rows.
A Concentration that deletes the effect directly must route through the same delete (T4).

**Grappled outcomes (D105).** An `ACTOR_RELATIONSHIP` outcome carries a required `heldAtOnce` and optional
`ESCAPE_CHECK` (allowed skill or ability checks; a `FIXED` or `CONTEST` DC) and `TARGET_SIZE_MAXIMUM`
modules. Holds are counted per `relationshipOutcomeId`: planning refuses a new hold when the source already
holds `heldAtOnce` other actors through that outcome. The effect planner applies the relationship's
conditions from its frozen `relationship-state` graph, which is not part of the action trace, so a
Character target's `CHARACTER_MECHANICS_BATCH` binds each of those `CONDITION_APPLY` applications to the
batch's own active-effect CREATE receipt (`frozenGraphNodeId`) and the TEST's result path rather than to a
kernel trace.

**Gated holds and held-only actions (D93, ATTACK-7.T8).** An `ACTOR_RELATIONSHIP` outcome's optional `appliesWhen`
(an attack-slot condition) gates the hold on the open Attack action: the planner evaluates it with
`attackSlotConditionHolds` over the attacks of `encounterAttackActionAttacks`, and outside an open Attack action it is
false. A `SINGLE_TARGET` selection with `heldBySource` is offered only on creatures the source holds
(`encounterHeldActorIds`); `prepareEncounterActionMechanics` refuses any other target. An `ON_USE` relationship needs
no roll and applies on use.

**Drag (D105, ATTACK-7.T7).** An outcome's `TARGET_DRAGGED` module makes its hold drag: the SRD Grapple and
the creature grapple riders author it. `encounterMovementDrag` finds the actors the mover itself holds through
such a hold (one level deep; nothing keys on the Grappled condition) for a voluntary, automated move. Each held
token moves by the mover's displacement in the same Scene move, spends no movement and provokes no opportunity
attack, and the mover's path ignores it as an obstacle. The drag doubles the mover's cost on top of the D154
maximum (difficult terrain costs ×4) unless every held creature is two or more sizes smaller; an unknown size
counts as not smaller. A mover stopped mid-path drags only the walked part. The room refuses a drag
(`MOVEMENT_BLOCKED`, "Release the grapple first.") whose dragged path is blocked, ends on an occupied place, or
enters, leaves or crosses a Scene effect (SPELLS-4.T1j).

**Escape against a fixed DC (D105, ATTACK-7.3).** A holder whose own Encounter effect carries an
`ESCAPE_CHECK` module (`dc.kind === 'FIXED'`, `actorKinds` including `TARGET`; the authoring schema and node map offer an Escape only `FIXED` and `CONTEST`) can spend the module's
authored `activation` to try to break the hold (`findEncounterHolderEscape`). `prepareEncounterEscapeCheck`
freezes the check for one allowed `skillIds` or `abilityDefinitionIds` entry: a Creature holder's total
comes from its `checkTotals` or, for an ability check, its score through the shared `abilityModifier`
(`actorContestFacts` reads both); a Character's from its rules. It then runs the same d20 core as First Aid
(`encounterBasicActionCheck.ts`, trigger `BASIC_ACTION_CHECK`, so the roll prompt reads "Escape: <check>
DC n"), with the pending context `ENCOUNTER_ESCAPE_CHECK` and the output `ESCAPE_CHECK` (`ESCAPED`, `FAILED`
or `ALREADY_ENDED` when a prompted roll settles after the effect ended). A total at or above the DC ends the
effect: `encounterEscapeEndedConditionIds` names the conditions only that effect owned (the effect's
`CONDITION_OWNERSHIP` contributions through `endedMaintenanceConditions`, so a condition another remaining
effect retains stays), and `encounterActorsAfterEscape` strips them from a Creature holder. A Character's
conditions live on its Sheet, so the room's plan does not carry them; persistence removes them with the
effect (`endEncounterEscapedEffect` reconciles the maintenance owners on the Character's stream). The
commit re-derives the escape from the holder's stored effect (`escapeEffectVerification.ts`) and refuses a
plan whose DC, check, module or spent allowance the effect does not carry. A failure only spends the
activation.
A Help on the escaper applies to the escape check and is used up with it.

**Contested escape (D152, ATTACK-7.3).** A holder effect whose `ESCAPE_CHECK` has `dc.kind === 'CONTEST'`
(`findEncounterHolderContestEscape`) is offered as an escape with `dc: null`. The `ESCAPE` command then runs
the one contest path (`prepareEncounterEscapeContest`, `planNativeLiveEscapeContest`): the escaper is the
initiator with its picked check, the effect's source is the defender with the contest's authored checks, the
origin is `ESCAPE` (`activeEffectId`, `initiatorCheckDefinitionId`, `actionLabel`) and the source is
`HELD_EFFECT`. It commits the one `CONTESTED_ACTION` output with `policy: null`. `settleContestEscape` spends
the activation; an escaper win ends the held effect through `endEncounterEscapedEffect` and records
`RELATIONSHIP_ENDED` (`endedEffectId`, `removedConditionIds`); a loss or tie keeps the hold. No hostile engagement
applies. Undo refuses a contested escape like other contests.

**Freeing another creature from a hold (ATTACK-7.9).** An `ESCAPE_CHECK` whose `actorKinds` include
`CREATURE_WITHIN_REACH` lets a creature other than the held one attempt the escape. `ESCAPE` gains an optional
`heldActorId` (the schema refuses `heldActorId === actorId`; absent, the actor escapes for itself), the escape
choice DTO carries `heldActorId: string | null`, and the pending context and `ESCAPE_CHECK` output carry it when
a rescuer rolls. `findEncounterRescues` lists the holds the actor may break: a `FIXED`-DC module allowing
`CREATURE_WITHIN_REACH` on another creature that stands within the reach the hold sealed
(`encounterActorsWithinReach`, the same footprint measure as `encounterEndedRelationships`, on the Run's bound
Scene), excluding a hold the actor itself applied (letting go is a release) and a pair the Scene does not place.
The planner resolves `activeEffectId` against the held creature's effects and refuses an effect not on
`heldActorId`. The rescuer rolls its own check (`findEncounterHolderEscape(effect, 'CREATURE_WITHIN_REACH')`
re-derives it at commit), spends its own activation, and a success ends the effect on the held creature through
the one escape end path. A zone's `CONDITION_ESCAPE` is held-creature-only. A rescuer that is itself held may
still free another creature. Undo follows the escape rule: a failure returns the activation, a success is refused.
**Unsupported:** a `CONTEST` DC with `CREATURE_WITHIN_REACH` is not offered to a rescuer (the contest path is the
held creature against its holder); `encounterRescues.test.ts` proves the omission.

**Contest outcomes (D105, ATTACK-7.6).** A CHECK action with a `CONTEST` dc whose `ON_CHECK_SUCCESS` outcome is a
condition or a forced movement (`isContestOutcomeAction`; Shove) compiles to `TEST_OUTCOME`: the test is the
contest graph, the outcome the specialized `ON_CHECK_SUCCESS` path. An outcome authored as a CHOICE is picked with
the attempt through `target.choiceOptionId`; `prepareEncounterActionSource` narrows a capability source (basic
action, Creature) to the picked option (`pickedCastChoiceEffect`), and the basic-action choices offer the options.
On a win the room runs the outcome graph (`planNativeContestOutcome`), applies its conditions to the target in the
one direct-outcome batch, and settles `CONDITIONS_APPLIED` or `FORCED_MOVEMENT` on the `CONTESTED_ACTION` output.
`settleContestOutcome` applies the room-planned conditions in Convex, and the commit lands a push through
`applyForcedMovements`, recorded on the `RESOLVE_ACTION` command (D157). Undo refuses it like other contests. A
contest outcome whose push owes a destination pick fails closed.

**Speed, hit point and sense grants (D99).** A `MODIFIER_GRANT` contribution carries modifier
operations and granted senses (`senses`, required; the SRD Darkvision spell is a 60-foot sense with no
modifier). A Character holder folds both through `withCharacterActiveGrants`; the room's scene vision folds
them before it draws the Character's senses. A Creature holder's speeds read `withActiveGrantSpeeds`, and
its maximum and every Character's read `effectiveHitPointMaximum`: the stored maximum plus `HIT_POINTS_MAX`
grants, then D79 reductions. When a grant ends, `planEncounterMaintenanceOwner` clamps current hit points to
the new maximum, and room Character reconciliation and Sheet rests bound hit points by the same maximum, so a
held grant's hit points survive them. The tabletop movement readout gives each speed type its own allowance and follows
speed grants. The speed type a move names (`MOVE_SCENE_TOKEN.speedId`, stored on the turn movement row) selects the allowance shown; `used` is the single total, so remaining feet at a type is that allowance minus `used` (SRD Using Different Speeds). Slot-scaled amounts (Aid's `SPELL_SLOT_LEVEL`) need cast-time resolution, so
`modifierGrantPlan` leaves them manual until spell casting (SPELLS-8) supplies it.

**Length modifiers (D112).** `SPEED` and `SENSE_RANGE` modifier payloads are typed lengths (`modifierLength.ts` parses
them; anything else throws). `evaluateDnd5eCharacterModifiers` turns each into feet, and
`characterMovementAndSenses` and `withActiveGrantSpeeds` convert the net back into the base's unit through the shared
`feetInLengthUnit`, floor it at 0, and pick the winning `SET_VALUE` speed through the one `widestLengthByKey` fold; a
speed with no base takes that modifier's unit. `resolveSpeedsFeet` reads speeds strictly against the System speed
vocabulary: Character record stats pass `registry.system.speeds`, and `encounterHolderState` takes the same list as
`speedDefinitions` (the worker's `INPUTS` capture, persistence's `requireSystem`). Publication owns the refusal, so a
malformed or out-of-vocabulary speed at read is an invariant failure. Displayed lengths round through the shared
`roundLengthForDisplay` (three decimals); stored and computed amounts never do.

The Sheet `MOVEMENT` `SPEED_OVERRIDE` adjustment is the same typed length, like the sense `RANGE_OVERRIDE`.
`buildCharacterMovementRuleFacts` hands the policy each speed as `base` (a length, or `null` when the Character holds
none) and `override`; a speed with neither is never listed, and `characterMovementAndSenses` throws on a fact with
neither. The override is converted into the base's unit, or kept in its own unit when there is no base. The Movement
panel marks a System speed the Character does not hold `NOT_HELD` (its editor still adds it) and carries the held
unit as the editor's `defaultUnit`, so the Sheet input offers an amount and a unit starting in the speed's own unit.

**Concentration grants (D99).** A grant whose result block names a `maintenanceDefinitionId` plans the
same `SOURCE_ACTOR` maintenance policy as a maintained recurring effect (`maintenancePlan`), so it is a
dependent of its source's maintained state and ends with it on a failed check, D95 incapacitation or a
replacing Concentration, through the generic dependent removal. A maintained grant on a
Character holder is `OWNER`-scoped from creation yet keeps its `sourceEncounterId` and
`maintainedEffectStateId` while the Run lives; a Creature holder's stays Encounter-scoped. When the Run
completes the link is detached and the grant carries over (see Carry-over). A carried grant ends when its
stamped caster starts another Concentration: `planConcentrationCarriedGrantEnds` picks the Character-owned
effects stamped with the caster (a null stamp is never ended); `prepareEncounterActionMaintenance` takes them
through `readCarried` and adds them to `removed`, and the receipt lists them as `endedCarriedGrants`
(CHARACTER-only, included in `characterOwnerTransitions` so the hit-point clamp and stream bump still run).
The room (`loadCarriedHolder`) loads each holder as a fenced target, on both the action and the
movement-reaction paths. `actionRevert` refuses a receipt with ended carried grants as a replaced
maintained effect. The same seam records the caster in the Run row's `concentrationCasterCharacterIds`
(`recordConcentrationCaster`; the stored command keeps `addedConcentrationCasterId` so the GM's undo
removes only an id that command added), which the checkpoint reads to end the caster's carried grants on Characters
outside the Run (see [persistence](persistence.md#encounter-run-storage)). The movement-reaction receipt
accepts an owner transition for a holder whose carried grant ends.

**Concentration is derived from the spell (SPELLS-8.T5).** A spell with the `CONCENTRATION` attribute marks each
compiled Effect group `requiresConcentration` (`compileSpell`), so an authored Concentration spell needs no
`maintenanceDefinitionId`: `maintenancePlan` plans the D&D Concentration maintenance
(`DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID`) for every active-effect plan the action ends up with. An
explicit `maintenanceDefinitionId` on a result block still overrides the derived one. A Concentration spell
whose action compiles to no maintained plan is not compiled (MANUAL on the Sheet), so a cast never skips the
Concentration it would start. Fly, Heroism, Protection from Energy, Shield of Faith and Hold Person rely on
the attribute alone.

**Repeated saves against the caster's DC.** The repeat-save plans (`repeatingDirectFollowUpSavePlan`,
`repeatingImmediateFollowUpSavePlan`, the recurring save of `supportedRecurringPlan`) pin their DC through one
helper, `pinnedSaveDc`: a fixed DC is stored in the plan's `dnd5e.save-dc` fact, and `SOURCE_SAVE_DC` sets
`castSaveDcFactKey`, so `prepareRecurringActiveEffect` stores the cast's own save DC (`d20.defenseOrDc`, from the
same `resolveSave` path every save-trigger plan uses) under that fact when the active effect is created. The repeat
graph's threshold reads the fact either way. Hold Person and Hold Monster author the SRD repeat save as a
`FOLLOW_UP_SAVE` after their Paralyzed condition, and the condition lasts the `conditionDurationTurns` of its
duration.

A `CONDITION` lead may be several conditions in one result block (Hideous Laughter: Prone and Incapacitated, then
one `FOLLOW_UP_SAVE`): each lead is a `conditionContributions` entry and its own proposal in the OUTCOME graph
(`nodePrefix` and `conditionOrdinal`, as in `timedConditionPlan`), and the plan's
`dnd5e.active-effect-repeat-save-condition-ids` fact is the comma-joined list that the terminal tick removes in
order. A grant lead or an escalation takes a single condition lead only. The follow-up's `repeatTriggers` (advantage
on a damage-triggered repeat) are stored on the plan's lifecycle; the Funnel hook that consumes them is T2m1b2.

**Immediate escalating save (ATTACK-5.T4b).** An immediate `FOLLOW_UP_SAVE` with no damage required before it
(Guardian Naga Spit Poison) and one whose failure applies a condition and then a once-only `TARGET_TURN_END`
save that ends the effect with a second condition (Cockatrice Bite) compile as `ESCALATING_CONDITION`.
`escalatingImmediateSave` checks the structure; `repeatingImmediateFollowUpSavePlan` gives the effect one turn tick
and stores the escalation condition under the same fact as the direct plan, so the repeat-save kernel is shared.

`repeatingDirectFollowUpSavePlan` takes a `CONDITION` or an `APPLY_GRANT` as its lead entry. A grant lead plans
its contribution through `modifierGrantEntryPlan` and marks it `countedByTurnEffects`: the repeat-save kernel
rolls, counts and ends it, so the grant tick planner neither adds its extra tick nor sets a recurrence stage. In
either case the lead applies only on `ON_SAVE_FAIL` (`reachesAuthoredPath`), so an area breath leaves nothing on a
creature that passes. Gold Dragon Weakening Breath is the grant-led case: Strength check, Strength save and
Strength attack disadvantage, ended by the repeated Strength save.

**Ability-scoped and fractional grants (SPELLS-19.T3b).** `ATTACK_ROLL` may name an `ability`; a grant naming one
covers only attacks made with it. A Character folds it through `dnd5eAttackRollContributors` (the action's
`attackAbility`); a Creature reads `creatureAttackAbility` (the first damage outcome's `ABILITY_BONUS`). Plain
`SAVING_THROW_MODIFIER` advantage and disadvantage naming an ability join every save row of that ability for a
Creature holder (`withCreatureActiveGrantSaves`). `SPEED` takes a `MULTIPLY` fraction payload (`n/d`), optionally
for one speed: `speedAfterFractions` multiplies the fractions and rounds down once (D94) after bonuses, for both
the Creature (`withActiveGrantSpeeds`) and Character (`characterMovementAndSenses`) folds.

**Chosen end (D101, SPELLS-5.11).** The caster ends their own Concentration at any time with no action
and no check. A Character uses the Sheet command `END_CONCENTRATION`: in a live table the room runs it
(`endChosenConcentration` in `packages/encounter-persistence`, a `CONCENTRATION_END` child receipt with
reason `CHOSEN`, keyed on the command id, plus a chat line); otherwise Convex ends the grants a finished
Run carried (`apps/apis/convex/characters/sheetConcentration.ts`, found through the
`by_concentrationCaster` index). When a holder of the caster's carried grant is in an ACTIVE Run, the web
asks `characters.sheetSlices.concentrationRoomRoute` and sends the command to Convex (the caster's own
and every outside holder; a holder an ACTIVE Run holds is skipped) and then through the room under the
same command id, even though the caster is not held; the room authorizes the caller, runs
`endOutsideCasterConcentration`, ends the held holders' grants at once, records the caster and writes the
GM-only history entry `CONCENTRATION_DROPPED_OUTSIDE`; the checkpoint stays the safety net. A Creature
or custom actor uses Encounter `UPDATE_ACTOR { endConcentration: true }` (GM only). The Sheet reads
`overview.concentration` (caster and GM only; label null for a hidden source); the Encounter actor
projection carries it for the actor's controllers and the GM.

**Concentration.** The damage-check graph and the `rule-maintenance` definition are published System
content shared by spells and features. A completed action stages one receipt-only child occurrence per
damage source against a maintained state, with the DC from that source's total damage. Assisted mode
pauses on the first child; only the GM or the holder's controller settles it. A Creature or custom actor holder makes the same check (SPELLS-9.2): `dnd5eConcentrationHolderSaves` reads its save rows from the Run actor's derived facts (ability modifier, the Creature's authored save proficiency bonus from the pinned `saveProficiencyBonuses` rule fact, and condition contributors), its pinned `targetCharacter` evidence is null, and a GM-controlled holder rolls under the GM's roll preference. Movement
damage, turn effects and Cleaving use the same coordinators (`encounterConcentration*`,
`encounterCleaving*`); the room modules are `nativeEncounterConcentration`, `nativeEncounterCleaving` and
`nativeEncounterMovementConcentration`.
A holder that is defeated or can't act after the commit's mechanics (`encounterActorCannotAct`: the
System actor-action capability, not Speed) loses Concentration with no check (D95). The planner returns
`concentrationEnds`; persistence re-derives each reason (`concentrationEnd.ts`), applies the lost-check
cleanup and writes a `CONCENTRATION_END` child receipt, which undo treats as lost Concentration.
Direct actions, turn effects, Cleaving, movement, GM actor edits and Sheet edits end it today. An edit's end (`endConcentrationAfterEdit`) is a child receipt of the edit's command id, and a Sheet edit shares its stream-version increment with the cleanup.
A movement contact that defeats or incapacitates the holder (a damaging spatial effect or condition, or a
movement reaction) ends it in `prepareEncounterMovementConcentration` before any check is planned, so the
cumulative projection rolls no check for that holder and later contacts observe the lost slot. The end
rides on the contact execution as `concentrationEnd` (one per contact, beside `concentrationChecks`),
settles as a `CONCENTRATION_END` movement settlement and persists through
`persistLiveMovementConcentrationEnd`, which re-derives the reason (`encounterConcentrationEndReason`,
shared with the direct planner). Known limit: a spatial effect that incapacitates only through a non-condition
active effect, and a reaction that affects a creature other than the batch target, are not detected.

**Movement and reactions.** Contacts form one frozen path timeline ordered by distance
(`encounterMovementPath`); spatial effects resolve before reaction candidates at the same distance, and a
typed stop closes newly invalid reactions. A reaction decision uses one Encounter-owned occurrence whose
sealed context is `CHOICE` then `ACTION_EVIDENCE`. Decline consumes nothing; use consumes the reaction
allowance and any authored cost only after the action completes. Assisted mode never uses a reaction on
anyone's behalf (`CONTROLLER_CHOICE`). The reusable `evidence.bounded-choice-index` operation records
only a numeric selection; the application holds the issued option identities. Hostile Passage contacts
(Overrun, Tumble) are ordered with spatial contacts and reactions
(`encounterMovementPassage*`). Reaction policy, eligibility and perception are System policy over
authoritative actor and Scene facts.

**Movement passage (current, SPELLS-33.T6k1).** What a mover may pass is authored data: a `MOVEMENT_PASSAGE`
`ADD_OPTION` modifier grant (`creatures`: `NONE`, `LARGER_THAN_SELF` or `ANY`; `mayEndInCreature`;
`blockingBarriers`; `costMultiplier`). A Character's grants come from its rule policy; a Creature's feature grants
fold through the same grant fold with holder kind `CREATURE` (`foldDnd5eCreatureFeatureGrants`) into
`ruleFacts.modifiers` on its snapshot, and a Character in a creature form moves with the form's.
`encounterActorMovementPassage` combines the grants as one union (widest relation, highest multiplier).
A hostile footprint the passage admits is crossed without a contest; one it does not admits only an
offered contest (Overrun, Tumble), and with none the move is refused `MOVEMENT_BLOCKED`, like ending inside.
The room prices each passed creature's footprint as a token-anchored zone at the passage multiplier, so
D154's highest-of terrain, zones and passage applies. A passage through blocking barriers is checked by
the server from the same prepared targets, and the room's Scene read model marks the token
`passesBlockingBarriers` from the same resolved passage (`roomSceneVision`) so the client's drag
validation (`sceneTokenMovementIndex`) cannot drift from it.

**Spell school immunity and checks against the holder (current, SPELLS-33.T6m1).** Two authored `ADD_OPTION`
modifier grants. `SPELL_SCHOOL_IMMUNITY` (`magicSchoolId`) folds into `spellSchoolImmunityIds`, a required
field of the folded target protection: a Character's from its rule policy (`characterDefenses`), a Creature's
from its feature grants and its active effects (`withCreatureActiveGrantProtection`). A Character's spell
cast carries the school of each spell it can cast (`CharacterSpellCastActions.magicSchoolIdBySpellId`), and
`encounterSpellSchoolImmunity` compares it with the target's. An area action leaves an immune creature out
with the creature-type exclusions (caught, no save, "was unaffected" in the GM's line); the other creatures
resolve. One target or a list of chosen creatures that includes an immune one is refused, like a source
immunity. A Creature's spell actions carry no school and are not gated. `CHECKS_AGAINST_HOLDER` (`skillId`)
folds into a Creature's feature modifiers and lists beneficially on the holder; it implies disadvantage on
the named skill's checks made against the holder, and is not enforced, since a check has no subject. The
Gynosphinx and Androsphinx Inscrutable and Mind Blank's divination clause are authored with them.

**Innate conditions and Magic Weapons (current, SPELLS-33.T4de).** A global `CONDITION` `ADD_OPTION`
(`conditionTypeId`) is a condition the holder always has: authored on a Creature feature (Invisible
Stalker's Invisibility) or any grant owner, beneficial on the holder's grant listing. `innateConditionIds`
folds the holder's features and active grants into `MovementTarget.innateConditionIds`; `state.conditions`
keeps only the conditions applied to it, so nothing removes or restores an innate one (there is no GM
command that removes a Creature's conditions). Every rule that reads what a condition does reads
`heldConditionIds(target)` (persisted plus innate): condition mechanics and perception, the action economy,
the target's condition ids in the action mechanics, holder defense (`canAct`), the occupant save auras and
the turn-effect perception. Reads deliberately left on the persisted `state.conditions` are state
transitions and baselines: the condition and flee sources in `encounterConditionMechanics`, the effect-plan
baseline in `encounterActionEffects`, and the before/after states, checksums and expected-state checks of
movement, turn effects and spatial execution. The Creature projection appends one `{conditionTypeId,
innate: true}` row per innate condition to `conditions`, so the GM and players see it (labelled by the
session reads, "(innate)" on the token) and the player `unseenReason` treats it like an applied one.
Magic Weapons is an `ATTACK_TRAIT` `ENABLE` grant (`trait: MAGICAL`): `dnd5eGrantedAttackTraits` is the one
reader, over a Character's folded modifiers and a Creature's feature modifiers alike, so a Creature's
attack is magical when it is a spell attack or an applicable grant says so. Both kinds are gone from the
closed rules.

**Creature passive save grants (current, SPELLS-33.T3a2).** A Creature feature's condition-scoped
`SAVING_THROW_MODIFIER` advantage or disadvantage grant is authored with the Character option and accepted by the
same feature-grant fold into `ruleFacts.modifiers`. The Encounter target build passes them to
`withCreatureActiveGrantSaves`, which adds each as a contributor, sourced from its feature, to the
condition-scoped save rows beside the active-effect ones. A `SKILL_MODIFIER` grant folds the same way, but
no Creature check reads roll modes yet.

**Combat Perception.** `encounterCombatPerception` is a pure resolver over pinned sense capabilities
(`pinnedSenseDefinitions` on the Character mechanics projection, `senseDefinitionId` identity), Scene
illumination and obscurement, line of effect, and typed active-effect contributions. Unknown definitions
fail closed to Manual/Judgment. Fog and viewer projection are never mechanics inputs.

The perception vocabulary and data shapes (channels, access grades, illumination, obscurement, capability and
contribution types) live in `packages/shared/src/domains/vtt/combatPerception.ts` because Scene, schema and
runtime share them. The resolution rules are D&D policy in `systems/dnd5e/combatPerception.ts`, reached through
`combatPerceptionCapabilityRegistry.require(gameSystemId).resolveCombatPerceptionWithContributions(...)`
(adapter interface in `combatPerceptionCapabilityRegistry.ts`, installed in `platformPolicyModules.ts` on the
generic System capability registry), which fails closed on a System
that provides no perception policy. The Rules Kernel holds no perception rules (ADR 0039 decision 5, RULES-2.T10).

Token light (current, SPELLS-33.T6j): a Creature's passive Feature that authors a MANIFEST OBJECT `light`
(the same SOURCE light shape equipment torches and lanterns and the Light and Continual Flame spells author)
sheds that light from its token. `creatureLight` reads it from the actor snapshot; nothing stores it on the
Scene. The Worker composes it onto bound tokens (`withSceneTokenLights`) for the Scene perception capture,
movement reactions and the room's vision display, and `resolveSceneIlluminationAt` treats each token light
as a point light at the token, radii measured from its footprint edge, for both perception (D108) and the
renderer. Activated item and spell lights are not consumed yet.

Attack-roll perception (current, D100): the room's `RESOLVE_ACTION` passes an optional
`loadAttackPerception` to `prepareEncounterActionMechanics`
(`packages/rules-runtime/src/encounterAttackPerception.ts`). For attack rolls it resolves requirement SEE both
ways (`SEES | UNSEEN`): a target that can't see the attacker gives advantage, an attacker that can't
see the target gets disadvantage, and Dodge's disadvantage is dropped only when the dodger definitively can't
see the attacker. Inputs are the ordinary-sight baseline, pinned senses, active effects, pinned condition
definitions (Invisible suppresses VISUAL emission unless a perceives-invisible sense such as truesight
bypasses it; Blinded suppresses VISUAL sensing) and, with a Scene whose id and version match the action's
lock, tokens, grid, lighting, darkness, barriers and spatial effects; without a Scene the environment is
neutral (bright, unobscured, line of effect). A Creature observer's senses are its structured stat-block
senses (D111), carried on the perception actor as `perceptionSenses` like a Character's. A Character's
`perceptionSenses` are its effective policy senses, so a sense its Active Effects grant (the Darkvision or
See Invisibility spell) perceives as its own features do (SPELLS-4.T2a4); a Creature's sense grants are not
folded yet. `createActorSensePinner` (`actorSenses.ts`) pins and validates them once per sense definition for the Worker and both movement perception paths. Not wired: Convex action preparation, Disarm,
opportunity attacks (movement-owned; movement reaction perception also omits condition contributions).

Believed vs true attack mode (current, D100): `encounterAttackBelief.ts` derives the roller's _believed_
contributors. These come from the attacker's own facts only, on the neutral environment
(`resolveEncounterBelievedAttackPerception`), with the true sight contributors swapped for the believed ones.
The pending action context stores the belief, and players' prompts show it; the GM sees the true mode. At
commit, a sight-governed d20 settles in the true mode whatever mode was chosen. `reconcileEncounterD20Faces`
cancels a die, changes which die is kept, or adds one: the app rolls it for an app roll, and the action
re-pends with `heldD20` for entered dice. The evidence's `modeAdjustment` carries the dice and the captions.
The card's `D20_MODE_ADJUSTED` rule check shows the generic player caption on the table, and the GM's history
copy shows the specific reason.

## Target and open scope

These are not current behavior:

- Phase 8.3 "Player play parity" ([ADR 0034](../adr/0034-player-control-rules-assistance-and-roll-prompts.md)):
  spell casting and area targeting, death saves, Sheet-tabletop integration, map targeting, non-movement
  reactions. Core spell casting and the slot spend are current (SPELLS-8.T1); the Fireball journey, Spare the Dying and `APPLY_GRANT` spells are SPELLS-8.T2 to T4. The gaps by area (grapple,
  conditions, `CLOSED_RULE` kinds with no resolver) are in
  [the RUL-9 audit](../handoffs/rul-9-rules-audit.md).
- Opposed-test, dice-pool and result-band, and level-less-track Kernel fixtures are conformance work, not
  current Kernel capabilities.
- Acceptance status of the room and Convex flows is tracked in the
  [Phase 8.2 acceptance ledger](../roadmap/08-2-convex-cutover-acceptance.md), not in this guide.

## Architect escalation

The architect owns product behavior, public and persisted contracts, security, concurrency, load-bearing
ownership and frozen acceptance. Implementers decide ordinary internal details. The complete routing rule
is in the repository root `AGENTS.md`.

**Critical hit rules (SPELLS-31.T5d, D158).** Two modifier domains change an attack's critical hits: `CRITICAL_HIT_THRESHOLD` (`CAP_VALUE`, the lowest natural d20 that crits, default 20, lowest source wins) and `CRITICAL_EXTRA_DICE` (`BONUS`, extra rolls of the attack's own damage die, so a crit rolls `2n + k`). Both carry an `attackDomain`; Improved and Superior Critical grant the first for melee, ranged and unarmed attacks, Brutal Critical grants the second for melee at Barbarian levels 9, 13 and 17. A Character reads accepted grants (`dnd5eAttackCriticalRules`), a Creature reads its held effects (`activeAttackCriticalRules`); Encounter prep passes the result as the `attackCriticalRules` source fact. The attack test operation (contract version 4) takes a required `criticalThreshold`, and commit-time verification checks it against the evidence fact. A roll at or above it is `ON_CRIT` whatever the target's AC; a natural 1 always misses. Added damage dice (D156) still only double.
