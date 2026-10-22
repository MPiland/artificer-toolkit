import type { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  currentSrdDefinition,
  createSrdRulesRuntime
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
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
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionContracts'
import { DND5E_SAVE_TEST_OPERATION_KEY } from '@artificer-toolkit/rules-runtime/systems/dnd5e/dnd5eTestOperationKeys'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  dnd5eAddedDiceFacts,
  dnd5eAddedDiceNode
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/d20AddedDiceGraph'

type EffectStore = ReturnType<typeof createActiveRuleEffectStore>

/**
 * A turn active effect on a creature actor: a Dexterity save (DC 30, so it always fails) at
 * `stage` that deals `damage` and ticks down from `ticks`. Returns the effect's id and the graph
 * definition the room must serve for it (`MovementRoomConfig.definitions`).
 */
export async function seedTurnSaveEffect(input: {
  effects: EffectStore
  encounterId: string
  actor: EncounterRunActorState
  stage: 'START_OF_TURN' | 'END_OF_TURN'
  ticks: number
  damage: number
  occurredAt: string
  /** Makes the effect a dependent of this maintained state: its owner and the occurrence that made it. */
  maintainedBy?: { stateId: string; sourceActorId: string; sourceOccurrenceId: string }
}) {
  const { actor } = input
  if (actor.kind === 'CHARACTER') throw new Error('Turn save effects target creature actors.')
  const definitionId = crypto.randomUUID()
  const entryId = crypto.randomUUID()
  const occurrenceId = input.maintainedBy?.sourceOccurrenceId ?? crypto.randomUUID()
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
          damageTypeId: { kind: 'LITERAL', value: crypto.randomUUID() }
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
  const runtime = createSrdRulesRuntime()
  const prepared = await runtime.executeResolvedWithGraph?.({
    command: {
      definitionId,
      occurrenceId,
      facts: {
        [DND5E_TARGET_ACTOR_FACT_KEY]: actor.id,
        [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
        ...dnd5eAddedDiceFacts([]),
        [DND5E_SAVE_DC_FACT_KEY]: 30,
        [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
        [DND5E_TEST_OUTCOME_RULE_FACT_KEY]: 'NONE',
        [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
          targetActorId: actor.id,
          currentHitPoints: actor.currentHitPoints,
          temporaryHitPoints: 0,
          maximumHitPoints: actor.maxHitPoints,
          conditionIds: []
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
  if (!prepared) throw new Error('Frozen turn-effect graph compilation unavailable.')
  const { id } = await input.effects.create({
    id: crypto.randomUUID(),
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: input.encounterId, targetActorId: actor.id },
    occurredAt: input.occurredAt,
    maintainedEffectStateId: input.maintainedBy?.stateId,
    definition: activeRuleEffectDefinitionDtoSchema.parse({
      schemaVersion: 2,
      linkedEffectId: null,
      stateContributions: [],
      origin: {
        kind: 'ENCOUNTER',
        sourceAggregateId: input.encounterId,
        sourceOccurrenceId: occurrenceId,
        rootCommandId: crypto.randomUUID(),
        sourceActorId: input.maintainedBy?.sourceActorId ?? actor.id
      },
      authoredEffectId: definitionId,
      compiledEntryId: entryId,
      frozenGraphNodeId: 'proposal-on_save_fail',
      frozenGraph: prepared.graph,
      adapterFacts: {
        [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]:
          SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
        [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'd20',
        [DND5E_SAVE_DC_FACT_KEY]: 30
      },
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: input.stage,
        consumeOnFirstEvents: [],
        endOnEvents: [],
        endOnTriggers: [],
        endOnConditionIds: [],
        holderEnd: null,
        lifetimeScope: 'ENCOUNTER',
        expiration: {
          kind: 'TICKS',
          initialRemaining: input.ticks,
          decrementStage: input.stage,
          anchor: 'HOLDER'
        }
      }
    }),
    lifecycle: { schemaVersion: 1, remainingTicks: input.ticks }
  })
  return {
    id,
    definition: currentSrdDefinition({
      id: definitionId,
      definitionFamilyKey: graph.definitionFamilyKey,
      label: 'Turn saving throw damage',
      description: 'Turn saving throw damage',
      document: graph,
      checksum: checksumRuleDocument(graph)
    })
  }
}
