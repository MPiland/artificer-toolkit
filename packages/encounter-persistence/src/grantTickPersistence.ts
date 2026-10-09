import { planEncounterGrantTicks } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import {
  turnEffectOwner,
  type TurnEffectBoundary
} from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActors } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

/**
 * Counts down every Modifier Grant anchored to this turn boundary, whoever holds it. Grants apply
 * no stored state, so unlike the turn-effect phase this writes no receipt and runs no graph.
 */
export async function persistEncounterGrantTicks(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    stage: TurnEffectBoundary['stage']
    turnActorId: string | null
  }
) {
  if (input.turnActorId === null) return
  const { state, stage, turnActorId } = input
  const store = createActiveRuleEffectStore(ctx)
  const holders = await Promise.all(
    (await readRunActors(ctx, state)).map(async (actor) => ({
      actor,
      effects: await store.list(turnEffectOwner(actor, state.id))
    }))
  )
  for (const tick of planEncounterGrantTicks({
    encounterId: state.id,
    stage,
    turnActorId,
    holders
  })) {
    const { effect, owner } = tick
    if (tick.kind === 'EXPIRE')
      await store.deleteCas({ id: effect.id, owner, expectedVersion: effect.version })
    else
      await store.updateLifecycleCas({
        id: effect.id,
        owner,
        expectedVersion: effect.version,
        lifecycle: { schemaVersion: 1, remainingTicks: tick.remainingTicks }
      })
  }
}
