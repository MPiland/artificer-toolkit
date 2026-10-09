import { planEncounterGrantTicks } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import {
  turnEffectOwner,
  type TurnEffectBoundary
} from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActors } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

/**
 * Counts down every Modifier Grant anchored to this turn boundary, whoever holds it. Grants apply
 * no stored state, so unlike the turn-effect phase this writes no receipt and runs no graph; an
 * expired grant's holder is reconciled like any ended effect's (Aid ending lowers current HP).
 */
export async function persistEncounterGrantTicks(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    stage: TurnEffectBoundary['stage']
    turnActorId: string | null
    occurredAt: string
  }
) {
  if (input.turnActorId === null) return
  const { state, stage, turnActorId } = input
  const store = createActiveRuleEffectStore(ctx)
  const actors = await readRunActors(ctx, state)
  const holders = await Promise.all(
    actors.map(async (actor) => ({
      actor,
      effects: await store.list(turnEffectOwner(actor, state.id))
    }))
  )
  const expired: ActiveRuleEffectRecord[] = []
  for (const tick of planEncounterGrantTicks({
    encounterId: state.id,
    stage,
    turnActorId,
    holders
  })) {
    const { effect, owner } = tick
    if (tick.kind === 'EXPIRE') {
      await store.deleteCas({ id: effect.id, owner, expectedVersion: effect.version })
      expired.push(effect)
    } else
      await store.updateLifecycleCas({
        id: effect.id,
        owner,
        expectedVersion: effect.version,
        lifecycle: { schemaVersion: 1, remainingTicks: tick.remainingTicks }
      })
  }
  if (expired.length === 0) return
  const characterIds = new Set(
    expired.flatMap(({ owner }) => (owner.kind === 'CHARACTER' ? [owner.characterId] : []))
  )
  const characterVersions = await Promise.all(
    [...characterIds].map(async (characterId) => {
      const row = await ctx.ports.readCharacterRow(characterId)
      if (!row) throw new Error('Grant holder Character is unavailable.')
      return { characterId, beforeStreamVersion: row.play.streamVersion }
    })
  )
  await reconcileNativeMaintenanceOwners(ctx, {
    encounterId: state.id,
    maintenance: { removed: expired, characterVersions },
    actors,
    occurredAt: input.occurredAt
  })
}
