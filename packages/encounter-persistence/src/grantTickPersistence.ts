import {
  encounterActorIdleTurnMark,
  withEncounterActorIdleTurnMark
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  planEncounterGrantTicks,
  planIdleTurnCheck
} from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import {
  turnEffectOwner,
  type TurnEffectBoundary
} from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActors, replaceRunActor } from './documents.js'
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
  await reconcileExpiredGrants(ctx, { state, expired, actors, occurredAt: input.occurredAt })
}

/**
 * Ends the idle-bound grants of the outgoing turn actor when its turn passed with no attack roll
 * against a hostile creature and no damage (SRD Rage), and resets its mark. Runs after everything
 * else the turn's end commits, such as a Legendary Action's damage, so that damage counts. An actor
 * with no mark holds no such grant, so its effects are never read.
 */
export async function persistEncounterIdleTurnCheck(
  ctx: EncounterCharacterWriteTransaction,
  input: { state: EncounterRunState; turnActorId: string | null; occurredAt: string }
) {
  if (input.turnActorId === null) return
  const { state } = input
  const actors = await readRunActors(ctx, state)
  const actor = actors.find(({ id }) => id === input.turnActorId)
  if (!actor || encounterActorIdleTurnMark(actor) === null) return
  const owner = turnEffectOwner(actor, state.id)
  const store = createActiveRuleEffectStore(ctx)
  const { ended, nextMark } = planIdleTurnCheck({
    encounterId: state.id,
    actor,
    effects: await store.list(owner)
  })
  for (const effect of ended)
    await store.deleteCas({ id: effect.id, owner, expectedVersion: effect.version })
  const marked = encounterRunActorStateSchema.parse({
    ...actor,
    resources: withEncounterActorIdleTurnMark(actor, nextMark)
  })
  await replaceRunActor(ctx, actor, marked)
  await reconcileExpiredGrants(ctx, {
    state,
    expired: ended,
    actors: actors.map((current) => (current.id === marked.id ? marked : current)),
    occurredAt: input.occurredAt
  })
}

/** Reconciles the holders of grants that just ended like any ended effect's (Aid ending lowers current HP). */
async function reconcileExpiredGrants(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    expired: ActiveRuleEffectRecord[]
    actors: EncounterRunActorState[]
    occurredAt: string
  }
) {
  const { expired } = input
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
    encounterId: input.state.id,
    maintenance: { removed: expired, characterVersions },
    actors: input.actors,
    occurredAt: input.occurredAt
  })
}
