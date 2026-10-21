import type {
  ActiveRuleEffectOwner,
  ActiveRuleEffectRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  activeRuleEffectDefinitionDtoSchema,
  type ActiveRuleEffectDefinitionDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import type {
  ActiveEffectConsumeEvent,
  ActiveEffectEndEvent
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY
} from '../systems/dnd5e/effectActionContracts.js'
import { DND5E_SAVE_TEST_OPERATION_KEY } from '../systems/dnd5e/dnd5eTestOperationKeys.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { ENCOUNTER_ID, SRD_SYSTEM_ID, TIMESTAMP, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { dnd5eAddedDiceFacts, dnd5eAddedDiceNode } from '../systems/dnd5e/d20AddedDiceGraph.js'

type StateContribution = Extract<
  ActiveRuleEffectDefinitionDto,
  { schemaVersion: 2 }
>['stateContributions'][number]

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

export const GOBLIN = srdByLabel(SRD.creatures, 'Goblin')

/** The Goblin's ability scores keyed by SRD ability definition, as its target scalars. */
export const GOBLIN_SCALARS = {
  [SRD_ABILITY_DEFINITION_IDS.STRENGTH]: 8,
  [SRD_ABILITY_DEFINITION_IDS.DEXTERITY]: 14,
  [SRD_ABILITY_DEFINITION_IDS.CONSTITUTION]: 10,
  [SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE]: 10,
  [SRD_ABILITY_DEFINITION_IDS.WISDOM]: 8,
  [SRD_ABILITY_DEFINITION_IDS.CHARISMA]: 8
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
  /** The events whose first occurrence ends the effect early; the turn kernel still counts it down. */
  endOnEvents?: readonly ActiveEffectEndEvent[]
  endOnTriggers?: readonly ActiveRuleEffectDefinitionDto['recurrence']['endOnTriggers'][number][]
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
    gameSystemId: SRD_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      dnd5eAddedDiceNode('d20'),
      {
        id: 'test',
        operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 3 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          addedTotal: { kind: 'NODE_OUTPUT', nodeId: 'd20-added-dice', port: 'value' },
          modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
          threshold: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
          contributorChecksum: { kind: 'FACT', factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY },
          outcomeRule: { kind: 'FACT', factKey: DND5E_TEST_OUTCOME_RULE_FACT_KEY }
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
        [DND5E_TEST_OUTCOME_RULE_FACT_KEY]: 'NONE',
        ...dnd5eAddedDiceFacts([]),
        [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
          targetActorId: input.target.id
        })
      }
    },
    published: serverPublishedRuleDefinitionDtoSchema.parse({
      id: definitionId,
      gameSystemId: SRD_SYSTEM_ID,
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
      consumeOnFirstEvents: [],
      endOnEvents: [...(input.endOnEvents ?? [])],
      endOnTriggers: [...(input.endOnTriggers ?? [])],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: input.lifetimeScope ?? 'ENCOUNTER',
      expiration:
        input.ticks === null
          ? { kind: 'INDEFINITE' }
          : {
              kind: 'TICKS',
              initialRemaining: input.ticks,
              decrementStage: stage === 'NONE' ? 'START_OF_TURN' : stage,
              anchor: 'HOLDER'
            }
    }
  }
  return prepareActiveRuleEffectRecord({
    id,
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: input.target.id },
    definition: activeRuleEffectDefinitionDtoSchema.parse({
      ...base,
      schemaVersion: 2,
      stateContributions: (input.conditionOwnership ?? []).map((entry) => ({
        kind: 'CONDITION_OWNERSHIP',
        ...entry
      }))
    }),
    lifecycle: { schemaVersion: 1, remainingTicks: input.ticks },
    maintainedEffectStateId: input.maintainedEffectStateId ?? null,
    currentEffects: input.currentEffects ?? [],
    occurredAt: TIMESTAMP
  })
}

/** A persisted schema-version-2 active effect carrying only the given state contributions. */
export function activeEffect(input: {
  id: string
  owner: ActiveRuleEffectOwner
  createdOrdinal: number
  version?: number
  consumeOnFirstEvents?: readonly ActiveEffectConsumeEvent[]
  endOnEvents?: readonly ActiveEffectEndEvent[]
  endOnTriggers?: readonly ActiveRuleEffectDefinitionDto['recurrence']['endOnTriggers'][number][]
  endOnConditionIds?: readonly string[]
  holderEnd?: ActiveRuleEffectDefinitionDto['recurrence']['holderEnd']
  /** The Encounter actor that applied the effect; none by default. */
  sourceActorId?: string | null
  stateContributions: [StateContribution, ...StateContribution[]]
}): ActiveRuleEffectRecord {
  const authoredEffectId = '00000000-0000-4000-8000-00000000b004'
  const compiledEntryId = '00000000-0000-4000-8000-00000000b005'
  const definition: ActiveRuleEffectDefinitionDto = {
    schemaVersion: 2,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: ENCOUNTER_ID,
      sourceOccurrenceId: '00000000-0000-4000-8000-00000000b006',
      rootCommandId: '00000000-0000-4000-8000-00000000b007',
      sourceActorId: input.sourceActorId ?? null
    },
    authoredEffectId,
    compiledEntryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId: authoredEffectId,
        gameSystemId: SRD_SYSTEM_ID,
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: compiledEntryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvents: [...(input.consumeOnFirstEvents ?? [])],
      endOnEvents: [...(input.endOnEvents ?? [])],
      endOnTriggers: [...(input.endOnTriggers ?? [])],
      endOnConditionIds: [...(input.endOnConditionIds ?? [])],
      holderEnd: input.holderEnd ?? null,
      lifetimeScope: 'OWNER',
      expiration: { kind: 'INDEFINITE' }
    },
    stateContributions: input.stateContributions
  }
  const lifecycle = { schemaVersion: 1 as const, remainingTicks: null }
  return {
    id: input.id,
    owner: input.owner,
    sourceEncounterId: ENCOUNTER_ID,
    maintainedEffectStateId: null,
    createdOrdinal: input.createdOrdinal,
    version: input.version ?? 1,
    definition,
    definitionChecksum: checksumRuleDocument(definition),
    lifecycle,
    lifecycleChecksum: checksumRuleDocument(lifecycle),
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  }
}

/** An SRD Shadow-style Strength Drain contribution (SCALAR_REDUCTION, floor 0, rest recovery). */
export function scalarReduction(valueDefinitionId: string, amount: number): StateContribution {
  return {
    kind: 'SCALAR_REDUCTION',
    valueDefinitionId,
    amount,
    stacking: 'ADDITIVE',
    floor: 0,
    recoveryTriggers: ['SHORT_REST', 'LONG_REST'],
    terminalConsequence: 'TARGET_DIED',
    sourceOutcomeId: '00000000-0000-4000-8000-00000000b008',
    sourceNodeId: 'entry',
    sourceOperationKey: 'comparison'
  }
}
