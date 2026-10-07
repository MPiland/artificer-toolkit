import {
  activeRuleEffectDefinitionDtoSchema,
  type EncounterMaintainedEffectDescriptorDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionCompiler'
import {
  createDnd5eMovementReactionChoiceDefinition,
  createDnd5eOpportunityReactionEligibilityDefinition,
  DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import {
  createSrdRulesRuntime,
  creatureFeature,
  currentSrdDefinition,
  srdDefinitions,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { srdCreatureRecords } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { adultBlackDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-black-dragon.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

/** The SRD rule definition the Legendary Resistance Feature names. */
const LEGENDARY_RESISTANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e4'

/** The SRD Wolf as the corpus seeds it. */
const srdWolf = (() => {
  const record = srdCreatureRecords.find((candidate) => candidate.id === wolf.id)
  if (!record) throw new Error('The SRD Wolf is missing.')
  return record
})()

/** A plain SRD Wolf: nothing it carries reacts to movement. */
export const plainWolf: CreatureAuthored = srdWolf

/** An SRD Wolf whose Bite is an opportunity attack, ending the mover's walk where it hits when `stopOnHit`. */
function opportunityWolf(stopOnHit: boolean): CreatureAuthored {
  const bite = creatureFeature(srdWolf, 'Bite')
  const biteEffect = bite.effects?.[0]
  if (!biteEffect || biteEffect.invocation.kind !== 'ACTION')
    throw new Error('The SRD Wolf Bite is missing.')
  return {
    ...srdWolf,
    features: [
      {
        ...bite,
        effects: [
          {
            ...biteEffect,
            invocation: {
              ...biteEffect.invocation,
              activation: { code: 'REACTION' as const, amount: 1 },
              reactionMovementTrigger: {
                kind: 'MOVEMENT' as const,
                stage: 'BEFORE_LEAVE_REACH' as const,
                perceptionRequirement: null,
                eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
                movementInterruption: stopOnHit
                  ? { kind: 'STOP' as const, whenResultPath: 'ON_HIT' as const }
                  : null
              }
            },
            paths: biteEffect.paths.slice(0, 1)
          }
        ]
      }
    ]
  }
}

/** An SRD Wolf whose Bite is an opportunity attack: a Reaction taken when a creature leaves its reach. */
export const reactionWolf = opportunityWolf(false)

/** The `reactionWolf` whose hit also stops the mover's walk at the contact. */
export const stopReactionWolf = opportunityWolf(true)

/**
 * The `reactionWolf` whose Bite makes its target save (DC 30 Dexterity, so a failed save is the
 * ordinary case) and stops the mover's walk at the contact on a failed save.
 */
export const saveStopWolf: CreatureAuthored = (() => {
  const bite = creatureFeature(reactionWolf, 'Bite')
  const effect = bite.effects?.[0]
  const trigger =
    effect?.invocation.kind === 'ACTION' ? effect.invocation.reactionMovementTrigger : null
  const damagePath = effect?.paths.find(
    (path) =>
      'resultBlock' in path &&
      path.resultBlock.outcomes.some((entry) => entry.effectKind === 'DAMAGE')
  )
  if (!effect || effect.invocation.kind !== 'ACTION' || !trigger || !damagePath)
    throw new Error('The reaction Wolf Bite is missing.')
  return {
    ...reactionWolf,
    features: [
      {
        ...bite,
        effects: [
          {
            ...effect,
            invocation: {
              ...effect.invocation,
              activation: { code: 'REACTION' as const, amount: 1 },
              triggerCode: 'SAVING_THROW' as const,
              savingThrow: {
                id: testUuid(0x7001),
                dcMethod: 'FIXED_DC' as const,
                baseDc: 30,
                abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
              },
              reactionMovementTrigger: {
                ...trigger,
                movementInterruption: {
                  kind: 'STOP' as const,
                  whenResultPath: 'ON_SAVE_FAIL' as const
                }
              }
            },
            paths: [{ ...damagePath, pathCode: 'ON_SAVE_FAIL' as const }]
          }
        ]
      }
    ]
  }
})()

/** A Wolf that carries the Dragon's Legendary Resistance (its saves may be turned into successes). */
export const legendaryWolf: CreatureAuthored = (() => {
  const resistance = adultBlackDragon.features?.find((feature) =>
    feature.ruleDefinitionIds?.includes(LEGENDARY_RESISTANCE_DEFINITION_ID)
  )
  if (!resistance) throw new Error('SRD Legendary Resistance is missing.')
  return {
    ...plainWolf,
    id: testUuid(0x7101),
    features: [...(plainWolf.features ?? []), resistance]
  }
})()

/** The policy definitions a movement reaction names; the SRD reusable set does not publish them. */
export const reactionPolicyDefinitions = [
  createDnd5eOpportunityReactionEligibilityDefinition(),
  createDnd5eMovementReactionChoiceDefinition()
].map((published) =>
  currentSrdDefinition({
    id: published.id,
    definitionFamilyKey: published.definitionFamilyKey,
    label: 'Movement reaction policy',
    description: 'Current D&D movement reaction policy.',
    document: published.definition,
    checksum: published.checksum
  })
)

/** No d20 reaches it, so a spatial save effect always fails its save. */
const SPATIAL_SAVE_DC = 30

type GraphNode = RuleGraphDefinition['nodes'][number]

/**
 * The Encounter-store input of a one-shot, public spatial effect that deals 1 fire damage to whoever
 * crosses its circle, or, with `save`, to whoever fails a Dexterity save against DC 30 (no one
 * passes). Its graph is frozen by the installed rules runtime, as casting freezes it.
 */
export async function spatialDamageEffect(input: {
  encounterId: string
  targetActorId: string
  center: ScenePoint
  radius: number
  /** Distinguishes several effects in one Scene: each carries its own identities and ordinal. */
  variant?: number
  /** Deals the damage only on a failed save, which the room rolls or asks for as d20 evidence. */
  save?: boolean
  /** Anchors the effect to a token instead of the Scene, so it travels with that token. */
  moving?: {
    sourceTokenId: string
    activation: 'ONE_SHOT' | 'REPEATABLE'
    hidden: boolean
  }
}) {
  const fire = SRD_DAMAGE_TYPES.find((type) => type.code === 'FIRE')
  if (!fire) throw new Error('The SRD fire damage type is missing.')
  const variant = input.variant ?? 0
  const definitionId = testUuid(0x6001 + variant * 0x10)
  const entryId = testUuid(0x6002 + variant * 0x10)
  const occurrenceId = testUuid(0x6003 + variant * 0x10)
  const damageNodeId = input.save ? 'proposal-on_save_fail' : 'damage'
  const d20Node = {
    id: 'd20',
    operation: { key: 'evidence.integer-range', contractVersion: 1 },
    inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
  } satisfies GraphNode
  const saveTestNode = {
    id: 'test',
    operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 1 },
    inputs: {
      targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
      naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
      modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
      threshold: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
      contributorChecksum: { kind: 'FACT', factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY }
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
    nodes: input.save ? [d20Node, saveTestNode, saveDamageNode] : [damageNode],
    outputs: input.save ? saveOutputs : damageOutputs,
    sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: damageNodeId }]
  } satisfies RuleGraphDefinition
  const runtime = await createSrdRulesRuntime()
  const prepared = await runtime.executeResolvedWithGraph?.({
    command: {
      definitionId,
      occurrenceId,
      facts: {
        [DND5E_TARGET_ACTOR_FACT_KEY]: input.targetActorId,
        ...(input.save && {
          [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
          [DND5E_SAVE_DC_FACT_KEY]: SPATIAL_SAVE_DC,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([])
        }),
        [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
          targetActorId: input.targetActorId,
          currentHitPoints: 1,
          temporaryHitPoints: 0,
          maximumHitPoints: 1,
          conditionIds: []
        })
      }
    },
    published: {
      id: definitionId,
      gameSystemId: SRD_SYSTEM_ID,
      definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
      checksum: checksumRuleDocument(graph),
      definition: graph
    }
  })
  if (!prepared) throw new Error('Frozen graph compilation is unavailable.')
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: occurrenceId,
      rootCommandId: testUuid(0x6004 + variant * 0x10),
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
      consumeOnFirstEvent: null,
      endOnEvents: [],
      lifetimeScope: 'ENCOUNTER',
      expiration: { kind: 'TICKS', initialRemaining: 3, decrementStage: 'END_OF_TURN' }
    }
  })
  const lifecycle = { schemaVersion: 1 as const, remainingTicks: 3 }
  const { moving } = input
  const spatialState = { schemaVersion: 1 as const, revealed: !moving?.hidden }
  const placement = moving
    ? {
        schemaVersion: 1 as const,
        anchorKind: 'TOKEN' as const,
        sourceTokenId: moving.sourceTokenId,
        geometry: {
          frame: 'TOKEN_LOCAL' as const,
          shape: { kind: 'CIRCLE' as const, center: { x: 0, y: 0 }, radius: input.radius }
        },
        triggerModes: ['CROSS' as const],
        movementKinds: ['VOLUNTARY' as const],
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
        triggerModes: ['CROSS' as const],
        movementKinds: ['VOLUNTARY' as const],
        activation: 'ONE_SHOT' as const,
        visibility: 'PUBLIC' as const,
        revealOnTrigger: false
      }
  return { id: testUuid(0x6005 + variant * 0x10), definition, lifecycle, placement, spatialState }
}

/** A Character's maintained Concentration, matching the SRD maintenance definition. */
export async function concentrationDescriptor(
  actorId: string
): Promise<EncounterMaintainedEffectDescriptorDto> {
  const definition = await srdDefinitions.requireCurrent(
    DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
  )
  return {
    schemaVersion: 2,
    maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
    definitionChecksum: definition.checksum,
    sourceActionId: 'maintained-source-action',
    sourceOccurrenceId: testUuid(0x4001),
    sourceActorId: actorId,
    replacementPolicy: 'REPLACE_SAME_DEFINITION',
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
  }
}
