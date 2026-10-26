import { type ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { ActorRelationshipAuthored } from '@artificer-toolkit/shared/authored'
import { addNumbersRuleOperation, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { publishedGraph } from './effectActionPublishedGraph.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_TOTAL_OPERATION_KEY,
  DND5E_HIT_POINT_LOSS_PROPOSAL_OPERATION_KEY,
  DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  type Dnd5eCompiledEffectActionSource,
  isUuid,
  UUID,
  unsupported
} from './effectActionContracts.js'
import { dnd5eRepeatSave } from './effectActionFollowUp.js'
import { compileTestDefinition } from './effectActionTestPhase.js'
import { parseBoundedDiceConfiguration } from './effectActionScalingFacts.js'
import { damageTypeIdentity } from './effectActionOutcomeNodes.js'

/**
 * The bare hold: the graph an action with no roll (Engulf) runs when used, and a hold with no
 * recurrence stores.
 */
export function relationshipStateGraph(input: {
  action: Dnd5eCompiledEffectActionSource
  relationshipId: string
}): ServerPublishedRuleDefinitionDto {
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'relationship-state',
        operation: {
          key: DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {}
      }
    ],
    outputs: {
      relationshipOutcomeId: { kind: 'LITERAL', value: input.relationshipId }
    },
    sourceEntryBindings: [{ sourceEntryId: input.relationshipId, nodeId: 'relationship-state' }]
  }
  return publishedGraph(definition)
}

/**
 * A hold's recurrence as the D&D compiler admits it: one exact damage or hit-point loss roll at the
 * start of the held creature's or its holder's turns, saved against at most one fixed DC, and the
 * graph node it settles. Hit points lost directly carry no damage type (null).
 */
export function relationshipRecurrencePlan(relationship: ActorRelationshipAuthored) {
  const recurrence = relationship.recurrence
  if (!recurrence) return null
  const { outcome, savingThrow, turnAnchor } = recurrence
  if (
    !UUID.test(outcome.id) ||
    !('diceConfig' in outcome) ||
    (outcome.effectKind === 'DAMAGE' &&
      (outcome.valueKind !== 'DICE' ||
        outcome.scalingKind !== 'NONE' ||
        outcome.bonuses?.length ||
        !isUuid(outcome.damageTypeId)))
  )
    unsupported('D&D relationship recurrence must be one exact damage or hit-point loss outcome.')
  if (turnAnchor.boundary !== 'START_OF_TURN')
    unsupported('D&D relationship recurrence counts only at the start of a turn.')
  // The hold's own roll is no saving throw, so it settles no caster's DC for the recurrence.
  const save =
    savingThrow?.dcMethod === 'FIXED_DC' && !savingThrow.bonuses?.length
      ? dnd5eRepeatSave({
          abilityDefinitionId: savingThrow.abilityDefinitionId,
          savingThrow,
          requestNodeId: 'd20'
        })
      : null
  if (savingThrow && !save) unsupported('D&D relationship recurrence saves against one fixed DC.')
  return {
    diceConfig: outcome.diceConfig,
    damageTypeId: outcome.effectKind === 'DAMAGE' ? damageTypeIdentity(outcome.damageTypeId) : null,
    save,
    frozenGraphNodeId: save ? 'proposal-on_save_fail' : 'relationship-recurrence'
  }
}

/** A failed save takes the damage or hit-point loss and a made one none; the hold stands either way. */
export function relationshipRecurrenceGraph(input: {
  action: Dnd5eCompiledEffectActionSource
  relationship: ActorRelationshipAuthored
  recurrence: NonNullable<ReturnType<typeof relationshipRecurrencePlan>>
  plan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'>
}): ServerPublishedRuleDefinitionDto {
  const { diceConfig, damageTypeId, save } = input.recurrence
  if (save)
    return compileTestDefinition(
      input.action,
      {
        kind: 'SAVE',
        branches: new Map([
          [
            'ON_SAVE_FAIL',
            damageTypeId === null
              ? {
                  kind: 'ENTRY_DICE_HIT_POINT_LOSS',
                  diceConfig,
                  entryId: input.relationship.id,
                  multiplier: 1
                }
              : {
                  kind: 'ENTRY_DICE_DAMAGE',
                  diceConfig,
                  damageTypeId,
                  entryId: input.relationship.id,
                  multiplier: 1
                }
          ]
        ])
      },
      input.plan
    )
  const parsed = parseBoundedDiceConfiguration(diceConfig)
  const { term } = parsed
  const dice = Array.from({ length: term.count }, (_, index) => ({
    id: `relationship-die-${index + 1}`,
    operation: { key: 'evidence.integer-range', contractVersion: 1 },
    inputs: {
      min: { kind: 'LITERAL' as const, value: 1 },
      max: { kind: 'LITERAL' as const, value: term.die }
    }
  }))
  const sums = Array.from({ length: Math.max(0, term.count - 1) }, (_, index) => ({
    id: `relationship-sum-${index + 1}`,
    operation: {
      key: addNumbersRuleOperation.key,
      contractVersion: addNumbersRuleOperation.contractVersion
    },
    inputs: {
      left:
        index === 0
          ? {
              kind: 'NODE_OUTPUT' as const,
              nodeId: 'relationship-die-1',
              port: 'value'
            }
          : {
              kind: 'NODE_OUTPUT' as const,
              nodeId: `relationship-sum-${index}`,
              port: 'value'
            },
      right: {
        kind: 'NODE_OUTPUT' as const,
        nodeId: `relationship-die-${index + 2}`,
        port: 'value'
      }
    }
  }))
  const subtotal =
    term.count === 1
      ? {
          kind: 'NODE_OUTPUT' as const,
          nodeId: 'relationship-die-1',
          port: 'value'
        }
      : {
          kind: 'NODE_OUTPUT' as const,
          nodeId: `relationship-sum-${term.count - 1}`,
          port: 'value'
        }
  const amount =
    parsed.modifier === 0
      ? subtotal
      : {
          kind: 'NODE_OUTPUT' as const,
          nodeId: 'relationship-damage-total',
          port: 'value'
        }
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      ...dice,
      ...sums,
      ...(parsed.modifier === 0
        ? []
        : [
            {
              id: 'relationship-damage-total',
              operation: {
                key: DND5E_DAMAGE_TOTAL_OPERATION_KEY,
                contractVersion: 1
              },
              inputs: {
                subtotal,
                modifier: { kind: 'LITERAL' as const, value: parsed.modifier }
              }
            }
          ]),
      {
        id: 'relationship-recurrence',
        operation: {
          key:
            damageTypeId === null
              ? DND5E_HIT_POINT_LOSS_PROPOSAL_OPERATION_KEY
              : DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          targetStateChecksum: {
            kind: 'FACT',
            factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
          },
          amount,
          ...(damageTypeId === null
            ? {}
            : { damageTypeId: { kind: 'LITERAL' as const, value: damageTypeId } })
        }
      }
    ],
    outputs: {
      targetActorId: {
        kind: 'NODE_OUTPUT',
        nodeId: 'relationship-recurrence',
        port: 'targetActorId'
      },
      amount: {
        kind: 'NODE_OUTPUT',
        nodeId: 'relationship-recurrence',
        port: 'amount'
      },
      ...(damageTypeId === null
        ? {}
        : {
            damageTypeId: {
              kind: 'NODE_OUTPUT' as const,
              nodeId: 'relationship-recurrence',
              port: 'damageTypeId'
            }
          })
    },
    sourceEntryBindings: [
      {
        sourceEntryId: input.relationship.id,
        nodeId: 'relationship-recurrence'
      }
    ]
  }
  return publishedGraph(definition)
}
