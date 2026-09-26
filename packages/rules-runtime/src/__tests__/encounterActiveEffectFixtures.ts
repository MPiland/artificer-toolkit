import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import type { ProjectableCharacterFacts } from '../encounterActionProjection.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import {
  compileInstalledCreatureRuleFacts,
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '../platformRulesRuntime.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY
} from '../systems/dnd5e/effectActionCompiler.js'

/** A canonical, deterministic UUID for test identities. */
export function testUuid(value: number) {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`
}

export const ENCOUNTER_ID = testUuid(0xe1)
export const CAMPAIGN_ID = testUuid(0xca)
export const SIDE_ID = testUuid(0x51)
export const GM_USER_ID = testUuid(0x9a)
export const OCCURRED_AT = '2026-09-26T00:00:00.000Z'
export const GAME_SYSTEM_ID = srdSystemRecord.id

export const FIRE_DAMAGE_TYPE_ID = srdCode(SRD_DAMAGE_TYPES, 'FIRE')
export const PRONE_CONDITION_ID = srdCode(SRD_CONDITION_TYPES, 'PRONE')
export const POISONED_CONDITION_ID = srdCode(SRD_CONDITION_TYPES, 'POISONED')
export const FRIGHTENED_CONDITION_ID = srdCode(SRD_CONDITION_TYPES, 'FRIGHTENED')
export const RESTRAINED_CONDITION_ID = srdCode(SRD_CONDITION_TYPES, 'RESTRAINED')

function srdCode(entries: readonly { id: string; code: string }[], code: string) {
  const match = entries.find((entry) => entry.code === code)
  if (!match) throw new Error(`SRD vocabulary code "${code}" is missing.`)
  return match.id
}

const snapshotIdentity = {
  snapshotId: testUuid(0x5a),
  systemId: srdSystemRecord.id,
  snapshotVersion: 1,
  schemaVersion: 1,
  document: srdSystemRecord
}

/** The SRD vocabulary snapshot, built the way Convex pins the current System document. */
export const SRD_VOCABULARY = systemVocabularySnapshotSchema.parse({
  ...snapshotIdentity,
  checksum: checksumCanonicalJson(snapshotIdentity)
})

export const GOBLIN = (() => {
  const creature = srdBaselineContent.subjects.creatures.find((entry) => entry.label === 'Goblin')
  if (!creature) throw new Error('SRD Goblin is missing.')
  // Blueprint snapshots pin explicit empty defense lists.
  return {
    ...creature,
    damageVulnerabilities: creature.damageVulnerabilities ?? [],
    damageResistances: creature.damageResistances ?? [],
    damageImmunities: creature.damageImmunities ?? [],
    conditionImmunities: creature.conditionImmunities ?? []
  }
})()

/** The Goblin's ability scores keyed by SRD ability definition, as its target scalars. */
export const GOBLIN_SCALARS = {
  [SRD_ABILITY_DEFINITION_IDS.STRENGTH]: 8,
  [SRD_ABILITY_DEFINITION_IDS.DEXTERITY]: 14,
  [SRD_ABILITY_DEFINITION_IDS.CONSTITUTION]: 10,
  [SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE]: 10,
  [SRD_ABILITY_DEFINITION_IDS.WISDOM]: 8,
  [SRD_ABILITY_DEFINITION_IDS.CHARISMA]: 8
}

/** An SRD Goblin actor carrying the rule facts a Blueprint snapshot pins. */
export function goblinActor(
  id: string,
  state: { currentHitPoints?: number; conditions?: readonly string[] } = {}
): EncounterRunActorState {
  return encounterRunActorStateSchema.parse({
    id,
    encounterId: ENCOUNTER_ID,
    kind: 'CREATURE',
    label: `Goblin ${id.slice(-2)}`,
    sourceId: GOBLIN.id,
    sourceRevision: 1,
    public: true,
    controllerUserIds: [],
    disposition: 'HOSTILE',
    initiative: 12,
    manualOrder: null,
    healthDisplay: null,
    systemId: GOBLIN.systemId,
    stableTieKey: id,
    currentHitPoints: state.currentHitPoints ?? GOBLIN.hitPoints,
    maxHitPoints: GOBLIN.hitPoints,
    tempHitPoints: 0,
    conditions: [...(state.conditions ?? [])],
    resources: {},
    gmNotes: null,
    sideId: SIDE_ID,
    snapshot: {
      kind: 'CREATURE',
      id: GOBLIN.id,
      label: GOBLIN.label,
      systemId: GOBLIN.systemId,
      sourceRevision: 1,
      sourceVersionId: testUuid(0x5b),
      sourceChecksum: 'b'.repeat(64),
      maxHitPoints: GOBLIN.hitPoints,
      payload: GOBLIN,
      ruleFacts: compileInstalledCreatureRuleFacts({
        creature: GOBLIN,
        vocabulary: SRD_VOCABULARY
      })
    },
    createdAt: OCCURRED_AT,
    updatedAt: OCCURRED_AT
  })
}

export function encounterRun(
  actors: readonly EncounterRunActorState[],
  input: { automationMode?: 'MANUAL' | 'ASSISTED'; currentActorId?: string | null } = {}
): EncounterRunState {
  const optionalCombatSnapshot = { schemaVersion: 1, gameSystemId: GAME_SYSTEM_ID, definitions: [] }
  return encounterRunStateSchema.parse({
    id: ENCOUNTER_ID,
    campaignId: CAMPAIGN_ID,
    gameSystemId: GAME_SYSTEM_ID,
    blueprintId: testUuid(0xb1),
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    name: 'Turn effect fixture',
    status: 'ACTIVE',
    automationMode: input.automationMode ?? 'ASSISTED',
    manualReminderMode: 'OFF',
    healthDisplayDefault: 'HIDDEN',
    version: 7,
    round: 1,
    currentActorId: input.currentActorId ?? actors[0]?.id ?? null,
    actorIds: actors.map((actor) => actor.id),
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    sides: [{ id: SIDE_ID, label: 'Enemies', sortOrder: 0 }],
    createdAt: OCCURRED_AT,
    updatedAt: OCCURRED_AT
  })
}

export function creatureTarget(actor: EncounterRunActorState, effects: ActiveRuleEffectRecord[]) {
  return buildMovementTarget<ProjectableCharacterFacts>({
    actor,
    activeEffects: effects,
    characterFacts: null,
    campaignId: CAMPAIGN_ID,
    gameSystemId: GAME_SYSTEM_ID
  })
}

/** A platform runtime that executes frozen graphs; it never resolves a current definition. */
export async function frozenRulesRuntime(): Promise<RulesRuntimeService> {
  return createPlatformRulesRuntime({
    continuationIntegrityKey: await deriveRulesContinuationKey('t'.repeat(32)),
    definitions: {
      requireCurrent: () => Promise.reject(new Error('Tests resolve no current definitions.'))
    }
  })
}

export type TurnSaveDamageEffectInput = {
  runtime: RulesRuntimeService
  /** Seeds the effect, definition, entry, occurrence and root command identities. */
  seed: number
  target: EncounterRunActorState
  damage: number
  saveDc: number
  recurrenceStage?: 'NONE' | 'START_OF_TURN' | 'END_OF_TURN'
  /** Remaining ticks decremented at the recurrence stage, or null for an indefinite effect. */
  ticks: number | null
  lifetimeScope?: 'OWNER' | 'ENCOUNTER'
  origin?: 'ENCOUNTER' | 'CHARACTER'
  sourceActorId?: string | null
  maintainedEffectStateId?: string | null
  conditionOwnership?: readonly { conditionId: string; baselinePresent: boolean }[]
  currentEffects?: readonly ActiveRuleEffectRecord[]
}

/**
 * A recurring "Dexterity save or take damage" effect owned by an Encounter actor, frozen and
 * checksummed exactly as the Convex effect store persists `seedTurnSaveEffect`.
 */
export async function turnSaveDamageEffect(
  input: TurnSaveDamageEffectInput
): Promise<ActiveRuleEffectRecord> {
  const id = testUuid(input.seed * 16)
  const definitionId = testUuid(input.seed * 16 + 1)
  const entryId = testUuid(input.seed * 16 + 2)
  const occurrenceId = testUuid(input.seed * 16 + 3)
  const rootCommandId = testUuid(input.seed * 16 + 4)
  const stage = input.recurrenceStage ?? 'START_OF_TURN'
  const graph = {
    schemaVersion: 1,
    id: definitionId,
    gameSystemId: GAME_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      {
        id: 'test',
        operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
          threshold: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
          contributorChecksum: { kind: 'FACT', factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY }
        }
      },
      {
        id: 'proposal-on_save_fail',
        operation: { key: DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          resolvedPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
          authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' },
          targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
          amount: { kind: 'LITERAL', value: input.damage },
          damageTypeId: { kind: 'LITERAL', value: FIRE_DAMAGE_TYPE_ID }
        }
      }
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'targetActorId' },
      naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
      total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
      contributorChecksum: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'contributorChecksum' }
    },
    sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'proposal-on_save_fail' }]
  } satisfies RuleGraphDefinition
  const executeResolvedWithGraph = input.runtime.executeResolvedWithGraph
  if (!executeResolvedWithGraph) throw new Error('Frozen graph compilation is unavailable.')
  const prepared = await executeResolvedWithGraph({
    command: {
      definitionId,
      occurrenceId,
      facts: {
        [DND5E_TARGET_ACTOR_FACT_KEY]: input.target.id,
        [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
        [DND5E_SAVE_DC_FACT_KEY]: input.saveDc,
        [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
        [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
          targetActorId: input.target.id
        })
      }
    },
    published: serverPublishedRuleDefinitionDtoSchema.parse({
      id: definitionId,
      gameSystemId: GAME_SYSTEM_ID,
      definitionFamilyKey: graph.definitionFamilyKey,
      checksum: checksumRuleDocument(graph),
      definition: graph
    })
  })
  const base = {
    origin:
      (input.origin ?? 'ENCOUNTER') === 'ENCOUNTER'
        ? {
            kind: 'ENCOUNTER',
            sourceAggregateId: ENCOUNTER_ID,
            sourceOccurrenceId: occurrenceId,
            rootCommandId,
            sourceActorId: input.sourceActorId === undefined ? input.target.id : input.sourceActorId
          }
        : {
            kind: 'CHARACTER',
            sourceAggregateId: testUuid(input.seed * 16 + 5),
            sourceOccurrenceId: occurrenceId,
            rootCommandId
          },
    authoredEffectId: definitionId,
    compiledEntryId: entryId,
    frozenGraphNodeId: 'proposal-on_save_fail',
    frozenGraph: prepared.graph,
    adapterFacts: {
      [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
      [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'd20',
      [DND5E_SAVE_DC_FACT_KEY]: input.saveDc
    },
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: stage,
      consumeOnFirstEvent: null,
      endOnEvents: [],
      lifetimeScope: input.lifetimeScope ?? 'ENCOUNTER',
      expiration:
        input.ticks === null
          ? { kind: 'INDEFINITE' }
          : {
              kind: 'TICKS',
              initialRemaining: input.ticks,
              decrementStage: stage === 'NONE' ? 'START_OF_TURN' : stage
            }
    }
  }
  return prepareActiveRuleEffectRecord({
    id,
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: input.target.id },
    definition: activeRuleEffectDefinitionDtoSchema.parse(
      input.conditionOwnership
        ? {
            ...base,
            schemaVersion: 2,
            stateContributions: input.conditionOwnership.map((entry) => ({
              kind: 'CONDITION_OWNERSHIP',
              ...entry
            }))
          }
        : { ...base, schemaVersion: 1 }
    ),
    lifecycle: { schemaVersion: 1, remainingTicks: input.ticks },
    maintainedEffectStateId: input.maintainedEffectStateId ?? null,
    currentEffects: input.currentEffects ?? [],
    occurredAt: OCCURRED_AT
  })
}
