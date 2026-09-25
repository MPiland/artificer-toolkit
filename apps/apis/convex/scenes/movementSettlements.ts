import {
  settleNativeMovementReactionAction,
  type NativeMovementReactionSettlementInput
} from '../encounters/actionMovementReactions'
import {
  settleNativeSpatialMovementPrefix,
  type NativeSpatialPrefixSettlement
} from '../encounters/spatialMovement'
import type { MutationCtx } from '../_generated/server'
import { consumeNativeActionEconomy } from '../encounters/actionEconomyPersistence'
import { movementCommandCharacterAggregateVersions } from '@artificer-toolkit/rules-runtime/encounterMovementChangedAggregates'
import {
  settleNativeMovementConcentration,
  type NativeMovementConcentrationSettlement
} from '../encounters/movementConcentration'

/** Read-only Scene evaluation retains these entries; finish dispatches them in order. */
export type SceneMovementSettlement =
  | { kind: 'SPATIAL'; plan: NativeSpatialPrefixSettlement }
  | { kind: 'REACTION'; plan: NativeMovementReactionSettlementInput }
  | { kind: 'PASSAGE'; plan: Omit<Parameters<typeof consumeNativeActionEconomy>[1], 'overridden'> }
  | { kind: 'CONCENTRATION'; plan: NativeMovementConcentrationSettlement }

export async function settleSceneMovementSettlements(
  ctx: MutationCtx,
  settlements: readonly SceneMovementSettlement[],
  terminal = false
) {
  const transitions = []
  const mechanicsChanged = settlements.some(
    (settlement) =>
      settlement.kind !== 'CONCENTRATION' ||
      settlement.plan.execution.result.applicationOutputs.cleanup !== null
  )
  for (const settlement of settlements) {
    if (settlement.kind === 'SPATIAL') {
      const settled = await settleNativeSpatialMovementPrefix(settlement.plan)
      transitions.push({
        kind: 'SPATIAL_PREFIX' as const,
        result: { ...settled.result, characterTransitions: settled.characterTransitions }
      })
    } else if (settlement.kind === 'REACTION') {
      const result = await settleNativeMovementReactionAction(ctx, settlement.plan)
      transitions.push({ kind: 'REACTION' as const, execution: result.reactionExecution })
    } else if (settlement.kind === 'CONCENTRATION') {
      const execution = await settleNativeMovementConcentration(
        ctx,
        settlement.plan,
        settlement.plan.state.version + (terminal || mechanicsChanged ? 1 : 0)
      )
      transitions.push({ kind: 'CONCENTRATION' as const, execution })
    } else {
      await consumeNativeActionEconomy(ctx, { ...settlement.plan, overridden: false })
    }
  }
  return {
    mechanicsChanged,
    characterTransitions: movementCommandCharacterAggregateVersions(transitions).map((span) => ({
      characterId: span.aggregateId,
      beforeStreamVersion: span.beforeVersion,
      afterStreamVersion: span.version
    }))
  }
}
