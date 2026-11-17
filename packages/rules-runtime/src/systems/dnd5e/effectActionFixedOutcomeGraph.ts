import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import {
  effectOutcomeProposalNode,
  effectOutcomeProposalOutputs
} from '../../effectOutcomeRegistry.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  UUID,
  conditionImmuneFactKey,
  uuid,
  type Dnd5eCompiledEffectActionSource,
  type Outcome
} from './effectActionContracts.js'
import { gateNodeInputs, isGated, testPathGates } from './effectActionGates.js'
import { forcedMovementProposalNode } from './effectActionOperationRegistry.js'
import { DND5E_OUTCOME_TARGET } from './effectActionOutcomeNodes.js'
import { dnd5eOutcomeDefinition } from './effectActionOutcomes.js'
import { DND5E_SYSTEM_ID } from './identity.js'

/**
 * The graph of an entry's fixed outcome: one direct proposal on its path, gated by the gates the
 * entry or its caller binds. An action's direct outcome and a placed zone's no-save damage share it.
 */
export function fixedOutcomeGraphDefinition(input: {
  action: Dnd5eCompiledEffectActionSource
  entry: CompiledEffectGroup['entries'][number]
  outcome: Outcome
  nodePrefix?: string
  /** The condition's place among its path's conditions, which selects its immunity fact. */
  conditionOrdinal?: number
  /** The hit-point band that gates the outcome: a hit-point tier's. */
  hitPointBand?: { above: number; atMost: number }
  /** The damage proposal node the outcome follows: it applies only if that damage reduced the target to 0. */
  reducedToZeroByNodeId?: string
  /** The challenge rating cap the source's level reaches for the outcome's gate. */
  challengeRatingCap?: number | undefined
}): RuleGraphDefinition {
  const proposalId = `${input.nodePrefix ?? ''}proposal-${input.entry.pathCode.toLowerCase()}`
  const gates = testPathGates(input.entry, input.outcome.kind, input)
  // The OUTCOME phase runs only on its selected path, so the push is authorized by construction.
  if (input.outcome.kind === 'FORCED_MOVEMENT') {
    uuid(input.entry.entryId, 'D&D forced movement identity')
    return {
      schemaVersion: 1,
      id: input.action.effectId,
      gameSystemId: DND5E_SYSTEM_ID,
      definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
      nodes: [
        forcedMovementProposalNode({
          id: proposalId,
          sourceEntryId: input.entry.entryId,
          resultPath: { kind: 'LITERAL', value: input.entry.pathCode },
          authoredPath: input.entry.pathCode,
          outcome: input.outcome
        })
      ],
      outputs: {
        targetActorId: { kind: 'NODE_OUTPUT', nodeId: proposalId, port: 'targetActorId' }
      },
      sourceEntryBindings: [{ sourceEntryId: input.entry.entryId, nodeId: proposalId }]
    }
  }
  const definition = dnd5eOutcomeDefinition(input.outcome.kind)
  return {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      effectOutcomeProposalNode({
        id: proposalId,
        definition,
        outcome: input.outcome,
        context: {
          conditionImmuneFactKey: conditionImmuneFactKey(
            input.entry.pathCode,
            input.conditionOrdinal ?? 1
          )
        },
        target: DND5E_OUTCOME_TARGET,
        phase: { kind: 'DIRECT', contractVersion: isGated(gates) ? 2 : 1 },
        extraInputs: isGated(gates) ? gateNodeInputs(gates) : {}
      })
    ],
    outputs: effectOutcomeProposalOutputs(definition, proposalId),
    ...(UUID.test(input.entry.entryId)
      ? {
          sourceEntryBindings: [{ sourceEntryId: input.entry.entryId, nodeId: proposalId }]
        }
      : {})
  }
}
