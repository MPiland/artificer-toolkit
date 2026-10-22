import { type ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { ActorRelationshipAuthored } from '@artificer-toolkit/shared/authored'
import { addNumbersRuleOperation, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { publishedGraph } from './effectActionPublishedGraph.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_TOTAL_OPERATION_KEY,
  DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  type Dnd5eCompiledEffectActionSource,
  unsupported
} from './effectActionContracts.js'
import { parseBoundedDiceConfiguration } from './effectActionScalingFacts.js'
import { damageTypeIdentity } from './effectActionOutcomeNodes.js'

/** The published graphs of an actor-relationship action: the bare state, and the one with a recurring damage roll. */
export function relationshipStateGraph(input: {
  action: Dnd5eCompiledEffectActionSource
  relationship: ActorRelationshipAuthored
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
      relationshipOutcomeId: { kind: 'LITERAL', value: input.relationship.id }
    },
    sourceEntryBindings: [{ sourceEntryId: input.relationship.id, nodeId: 'relationship-state' }]
  }
  return publishedGraph(definition)
}

export function relationshipRecurrenceGraph(input: {
  action: Dnd5eCompiledEffectActionSource
  relationship: ActorRelationshipAuthored
  modules: readonly ActorRelationshipAuthored['modules'][number][]
  recurrenceDamage: NonNullable<ActorRelationshipAuthored['recurrence']>['damage']
}): ServerPublishedRuleDefinitionDto {
  if (!('diceConfig' in input.recurrenceDamage))
    unsupported('D&D relationship recurrence dice are unavailable.')
  const parsed = parseBoundedDiceConfiguration(input.recurrenceDamage.diceConfig!)
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
          key: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          targetStateChecksum: {
            kind: 'FACT',
            factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
          },
          amount,
          damageTypeId: {
            kind: 'LITERAL',
            value: damageTypeIdentity(input.recurrenceDamage.damageTypeId)
          }
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
      damageTypeId: {
        kind: 'NODE_OUTPUT',
        nodeId: 'relationship-recurrence',
        port: 'damageTypeId'
      }
    },
    sourceEntryBindings: [
      {
        sourceEntryId: input.relationship.id,
        nodeId: 'relationship-recurrence'
      }
    ]
  }
  void input.modules
  return publishedGraph(definition)
}
