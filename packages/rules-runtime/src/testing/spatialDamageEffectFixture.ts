import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY
} from '../systems/dnd5e/effectActionContracts.js'
import { DND5E_SAVE_TEST_OPERATION_KEY } from '../systems/dnd5e/dnd5eTestOperationKeys.js'
import { dnd5eAddedDiceFacts, dnd5eAddedDiceNode } from '../systems/dnd5e/d20AddedDiceGraph.js'

/** No d20 reaches it, so a spatial save effect always fails its save. */
const SPATIAL_SAVE_DC = 30

type GraphNode = RuleGraphDefinition['nodes'][number]

/**
 * The persisted input of a public spatial effect that deals 1 fire damage to whoever crosses its
 * circle, or, with `save`, to whoever fails a Dexterity save against DC 30 (no one passes). Its
 * graph is frozen by the supplied rules runtime, as casting freezes it. With  (and no
 * ), it applies that condition instead of dealing damage. Fixture data only: the runtime,
 * not this builder, decides what the graph does.
 */
export async function buildSpatialDamageEffect(input: {
  runtime: Pick<RulesRuntimeService, 'executeResolvedWithGraph'>
  encounterId: string
  targetActorId: string
  /** The target's current and maximum Hit Points, which the damage proposal pins by checksum. */
  targetHitPoints: number
  center: ScenePoint
  radius: number
  ids: {
    effectId: string
    definitionId: string
    entryId: string
    occurrenceId: string
    rootCommandId: string
  }
  /** Deals the damage only on a failed save, which the room rolls or asks for as d20 evidence. */
  save: boolean
  /** Applies this condition to whoever crosses the circle, dealing no damage. */
  condition?: { conditionId: string }
  /** Ticks the effect lasts, or null while it never expires. */
  remainingTicks: number | null
  /** Anchors the effect to a token instead of the Scene, so it travels with that token. */
  moving?: {
    sourceTokenId: string
    activation: 'ONE_SHOT' | 'REPEATABLE'
    hidden: boolean
  }
  /** Makes a Scene-fixed effect a hidden, unrevealed field that allows passage at half speed. */
  hiddenHalfSpeedField?: boolean
  /** The kinds of movement that trigger the effect; a voluntary move alone unless it says more. */
  movementKinds?: ('VOLUNTARY' | 'FORCED' | 'TELEPORT')[]
  /** What triggers the effect; crossing the circle alone unless it says more. */
  triggerModes?: ('ENTER' | 'EXIT' | 'CROSS')[]
  /** Whether a Scene-fixed effect is spent by its first trigger; one-shot unless it says otherwise. */
  activation?: 'ONE_SHOT' | 'REPEATABLE'
}) {
  const fire = SRD_DAMAGE_TYPES.find((type) => type.code === 'FIRE')
  if (!fire) throw new Error('The SRD fire damage type is missing.')
  const { definitionId, entryId, occurrenceId } = input.ids
  const damageNodeId = input.save ? 'proposal-on_save_fail' : 'damage'
  if (input.condition && input.save)
    throw new Error('A spatial condition effect cannot also require a save.')
  const d20Node = {
    id: 'd20',
    operation: { key: 'evidence.integer-range', contractVersion: 1 },
    inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
  } satisfies GraphNode
  const saveTestNode = {
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
  } satisfies GraphNode
  const saveDamageNode = {
    id: damageNodeId,
    operation: { key: DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
    inputs: {
      targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
      resolvedPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
      authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' },
      targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
      amount: { kind: 'LITERAL', value: 1 },
      damageTypeId: { kind: 'LITERAL', value: fire.id }
    }
  } satisfies GraphNode
  const damageNode = {
    id: damageNodeId,
    operation: { key: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
    inputs: {
      targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
      targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
      amount: { kind: 'LITERAL', value: 1 },
      damageTypeId: { kind: 'LITERAL', value: fire.id }
    }
  } satisfies GraphNode
  const conditionNode = {
    id: damageNodeId,
    operation: { key: DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
    inputs: {
      targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
      targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
      conditionId: { kind: 'LITERAL', value: input.condition?.conditionId ?? '' },
      conditionImmune: { kind: 'FACT', factKey: DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY }
    }
  } satisfies GraphNode
  const conditionOutputs = {
    targetActorId: { kind: 'NODE_OUTPUT', nodeId: damageNodeId, port: 'targetActorId' },
    conditionId: { kind: 'NODE_OUTPUT', nodeId: damageNodeId, port: 'conditionId' }
  } satisfies RuleGraphDefinition['outputs']
  const saveOutputs = {
    targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'targetActorId' },
    naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
    total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
    resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
    contributorChecksum: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'contributorChecksum' }
  } satisfies RuleGraphDefinition['outputs']
  const damageOutputs = {
    targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'damage', port: 'targetActorId' },
    amount: { kind: 'NODE_OUTPUT', nodeId: 'damage', port: 'amount' },
    damageTypeId: { kind: 'NODE_OUTPUT', nodeId: 'damage', port: 'damageTypeId' }
  } satisfies RuleGraphDefinition['outputs']
  const graph = {
    schemaVersion: 1,
    id: definitionId,
    gameSystemId: SRD_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: input.save
      ? [d20Node, dnd5eAddedDiceNode('d20'), saveTestNode, saveDamageNode]
      : [input.condition ? conditionNode : damageNode],
    outputs: input.save ? saveOutputs : input.condition ? conditionOutputs : damageOutputs,
    sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: damageNodeId }]
  } satisfies RuleGraphDefinition
  const prepared = await input.runtime.executeResolvedWithGraph?.({
    command: {
      definitionId,
      occurrenceId,
      facts: {
        [DND5E_TARGET_ACTOR_FACT_KEY]: input.targetActorId,
        ...(input.save && {
          [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
          ...dnd5eAddedDiceFacts([]),
          [DND5E_SAVE_DC_FACT_KEY]: SPATIAL_SAVE_DC,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
          [DND5E_TEST_OUTCOME_RULE_FACT_KEY]: 'NONE'
        }),
        ...(input.condition && { [DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY]: false }),
        [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
          targetActorId: input.targetActorId,
          currentHitPoints: input.targetHitPoints,
          temporaryHitPoints: 0,
          maximumHitPoints: input.targetHitPoints,
          conditionIds: []
        })
      }
    },
    published: serverPublishedRuleDefinitionDtoSchema.parse({
      id: definitionId,
      gameSystemId: SRD_SYSTEM_ID,
      definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
      checksum: checksumRuleDocument(graph),
      definition: graph
    })
  })
  if (!prepared) throw new Error('Frozen graph compilation is unavailable.')
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
    stateContributions: [],
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: occurrenceId,
      rootCommandId: input.ids.rootCommandId,
      sourceActorId: null
    },
    authoredEffectId: definitionId,
    compiledEntryId: entryId,
    frozenGraphNodeId: damageNodeId,
    frozenGraph: prepared.graph,
    adapterFacts: input.save
      ? {
          [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]:
            SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
          [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'd20',
          [DND5E_SAVE_DC_FACT_KEY]: SPATIAL_SAVE_DC
        }
      : {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: 'ENCOUNTER',
      expiration:
        input.remainingTicks === null
          ? { kind: 'INDEFINITE' }
          : {
              kind: 'TICKS',
              initialRemaining: input.remainingTicks,
              decrementStage: 'END_OF_TURN',
              anchor: 'HOLDER'
            }
    }
  })
  const lifecycle = { schemaVersion: 1 as const, remainingTicks: input.remainingTicks }
  const { moving } = input
  const hiddenField = !moving && input.hiddenHalfSpeedField === true
  const spatialState = {
    schemaVersion: 1 as const,
    revealed: !moving?.hidden && !hiddenField
  }
  const placement = moving
    ? {
        schemaVersion: 1 as const,
        anchorKind: 'TOKEN' as const,
        sourceTokenId: moving.sourceTokenId,
        geometry: {
          frame: 'TOKEN_LOCAL' as const,
          shape: { kind: 'CIRCLE' as const, center: { x: 0, y: 0 }, radius: input.radius }
        },
        triggerModes: input.triggerModes ?? ['CROSS' as const],
        movementKinds: input.movementKinds ?? ['VOLUNTARY' as const],
        activation: moving.activation,
        visibility: moving.hidden ? ('HIDDEN' as const) : ('PUBLIC' as const),
        revealOnTrigger: moving.hidden
      }
    : {
        schemaVersion: 1 as const,
        anchorKind: 'FIXED' as const,
        sourceTokenId: null,
        geometry: {
          frame: 'SCENE_ABSOLUTE' as const,
          shape: { kind: 'CIRCLE' as const, center: input.center, radius: input.radius }
        },
        triggerModes: input.triggerModes ?? ['CROSS' as const],
        movementKinds: input.movementKinds ?? ['VOLUNTARY' as const],
        activation: input.activation ?? ('ONE_SHOT' as const),
        visibility: hiddenField ? ('HIDDEN' as const) : ('PUBLIC' as const),
        revealOnTrigger: false,
        ...(hiddenField && { bypassAtHalfSpeed: true })
      }
  return { id: input.ids.effectId, definition, lifecycle, placement, spatialState }
}
