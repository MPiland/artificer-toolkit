import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import type { RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import {
  unsupported,
  DND5E_DAMAGE_TOTAL_OPERATION_KEY,
  DND5E_HEAL_TOTAL_OPERATION_KEY,
  DND5E_HEALING_MAXIMIZED_FACT_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
  DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
  DND5E_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  UUID
} from './effectActionContracts.js'
import {
  damageTypeIdentity,
  rolledDiceNodes,
  multipliedDamage,
  damageMultiplier
} from './effectActionOutcomeNodes.js'
import { boundedDiceTerm } from './effectActionScalingFacts.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import type { Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'

export function diceGraphDefinition(input: {
  action: Dnd5eCompiledEffectActionSource
  entry: CompiledEffectGroup['entries'][number]
  diceConfig: string
  /** Roll the dice twice plus the extra dice for a critical hit; the modifier is still added once. */
  critical?: { extraDice: number }
  modifierFactKey?: string
  nodePrefix?: string
  recurring?: Pick<CharacterRuleActionActiveEffectPlan, 'compiledEntryId' | 'frozenGraphNodeId'>
}): RuleGraphDefinition {
  if (
    !('outcome' in input.entry) ||
    (input.entry.outcome.effectKind !== 'DAMAGE' &&
      input.entry.outcome.effectKind !== 'HEAL' &&
      input.entry.outcome.effectKind !== 'SCALAR_REDUCTION')
  )
    unsupported('Only direct D&D dice outcomes are currently specialized.')
  const outcome = input.entry.outcome
  const scalar = outcome.effectKind === 'SCALAR_REDUCTION'
  if (!scalar && outcome.valueKind !== 'DICE') unsupported('D&D outcome is not dice-backed.')
  const damageTypeId =
    outcome.effectKind === 'DAMAGE' ? damageTypeIdentity(outcome.damageTypeId) : null
  const prefix = input.nodePrefix ?? ''
  const { modifier: authoredModifier, term } = boundedDiceTerm(input.diceConfig, input.critical)
  const { nodes: rolledNodes, subtotal: rolledSubtotal } = rolledDiceNodes(term, prefix)
  const modifier = input.modifierFactKey
    ? { kind: 'FACT' as const, factKey: input.modifierFactKey }
    : { kind: 'LITERAL' as const, value: authoredModifier }
  const needsTotal = input.modifierFactKey !== undefined || authoredModifier !== 0
  const totalNodeId = `${prefix}${outcome.effectKind === 'DAMAGE' ? 'damage' : scalar ? 'scalar' : 'heal'}-total`
  const totalNode = !needsTotal
    ? []
    : [
        {
          id: totalNodeId,
          operation: {
            key:
              outcome.effectKind === 'DAMAGE'
                ? DND5E_DAMAGE_TOTAL_OPERATION_KEY
                : DND5E_HEAL_TOTAL_OPERATION_KEY,
            contractVersion: 1
          },
          inputs: {
            subtotal: rolledSubtotal,
            ...(outcome.effectKind === 'DAMAGE'
              ? {}
              : {
                  // Only hit point healing takes its maximum (Beacon of Hope); temporary hit points do not.
                  maximumSubtotal: { kind: 'LITERAL' as const, value: term.count * term.die },
                  maximized:
                    outcome.effectKind === 'HEAL' && !outcome.temporary && input.modifierFactKey
                      ? { kind: 'FACT' as const, factKey: DND5E_HEALING_MAXIMIZED_FACT_KEY }
                      : { kind: 'LITERAL' as const, value: false }
                }),
            modifier
          }
        }
      ]
  const total = !needsTotal
    ? rolledSubtotal
    : { kind: 'NODE_OUTPUT' as const, nodeId: totalNodeId, port: 'value' }
  const { nodes: multiplierNode, amount } = multipliedDamage(
    `${prefix}damage-multiplied`,
    total,
    outcome.effectKind === 'DAMAGE' ? damageMultiplier(outcome) : 1
  )
  const proposalId =
    input.recurring?.frozenGraphNodeId ?? `${prefix}proposal-${input.entry.pathCode.toLowerCase()}`
  const sourceEntryId = input.recurring?.compiledEntryId ?? input.entry.entryId
  const proposalOperation =
    outcome.effectKind === 'DAMAGE'
      ? DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
      : scalar
        ? DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY
        : outcome.temporary
          ? DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
          : DND5E_HEAL_PROPOSAL_OPERATION_KEY
  return {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      ...rolledNodes,
      ...totalNode,
      ...multiplierNode,
      {
        id: proposalId,
        operation: { key: proposalOperation, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          targetStateChecksum: {
            kind: 'FACT',
            factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
          },
          amount,
          ...(damageTypeId === null
            ? {}
            : { damageTypeId: { kind: 'LITERAL' as const, value: damageTypeId } }),
          ...(scalar
            ? {
                valueDefinitionId: { kind: 'LITERAL' as const, value: outcome.valueDefinitionId },
                recoveryTriggers: {
                  kind: 'LITERAL' as const,
                  value: JSON.stringify(outcome.recoveryTriggers)
                },
                terminalConsequence: {
                  kind: 'LITERAL' as const,
                  value: outcome.terminalConsequence
                }
              }
            : {})
        }
      }
    ],
    outputs: {
      targetActorId: {
        kind: 'NODE_OUTPUT',
        nodeId: proposalId,
        port: 'targetActorId'
      },
      amount: { kind: 'NODE_OUTPUT', nodeId: proposalId, port: 'amount' },
      ...(outcome.effectKind === 'DAMAGE'
        ? {
            damageTypeId: {
              kind: 'NODE_OUTPUT' as const,
              nodeId: proposalId,
              port: 'damageTypeId'
            }
          }
        : {})
    },
    ...(UUID.test(sourceEntryId)
      ? {
          sourceEntryBindings: [{ sourceEntryId, nodeId: proposalId }]
        }
      : {})
  }
}
