import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  grantsEndedByHolderState,
  stateBoundGrants
} from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { persistNativeConcentrationEnd } from './actionChildPersistence.js'
import {
  applyLiveConcentrationCleanup,
  deriveLiveConcentrationCleanup
} from './concentrationCleanupPersistence.js'
import {
  postConcentrationEndMessage,
  postGrantEndMessages,
  readHolderEndState
} from './concentrationEnd.js'
import { deleteGrants } from './consumedGrantPersistence.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'

/**
 * Ends the holder's Concentration with no check (D95), and the holder's grants its state ends
 * (incapacitation, or a condition they name), when a GM actor edit or a Sheet edit, already written in this transaction, left it
 * defeated or unable to act. The edit's command id stands in
 * for the parent occurrence, so the end is a child receipt like any other D95 end. A MANUAL Run and
 * a holder still able to act end nothing.
 */
export async function endConcentrationAfterEdit(
  ctx: EncounterCharacterWriteTransaction & {
    ports: EncounterCharacterWriteTransaction['ports'] &
      Pick<EncounterWritePorts, 'postRulesChatMessage'>
  },
  input: {
    state: EncounterRunState
    /** Every Run actor as the edit left it. */
    actors: EncounterRunActorState[]
    /** The edited holder as the edit left it. */
    holder: EncounterRunActorState
    editCommandId: string
    userId: string
    occurredAt: string
    /** Characters whose stream version the edit already advanced in this transaction. */
    advancedCharacterIds?: ReadonlySet<string>
  }
) {
  const { state, holder } = input
  if (state.automationMode === 'MANUAL') return
  const store = createActiveRuleEffectStore(ctx)
  const slot = await store.findMaintainedState({
    encounterId: state.id,
    ownerActorId: holder.id,
    maintenanceDefinitionId: requireInstalledConcentrationMaintenanceDefinitionId(
      state.gameSystemId
    )
  })
  const stateBound = stateBoundGrants(await store.list(turnEffectOwner(holder, state.id)))
  if (!slot && !stateBound.length) return
  const holderState = await readHolderEndState(ctx, {
    state,
    actor: holder,
    userId: input.userId
  })
  const endedGrants = grantsEndedByHolderState(stateBound, holderState)
  await deleteGrants(ctx, endedGrants)
  await postGrantEndMessages(ctx, {
    state,
    actor: holder,
    grants: endedGrants,
    occurrenceId: input.editCommandId,
    userId: input.userId
  })
  const { reason } = holderState
  if (!slot || !reason) return
  const authorizedCharacterIds = new Set(
    input.actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  const { cleanup } = await deriveLiveConcentrationCleanup(ctx, {
    state,
    slot,
    authorizedCharacterIds,
    advancedCharacterIds: input.advancedCharacterIds
  })
  await applyLiveConcentrationCleanup(ctx, {
    state,
    actors: input.actors,
    slot,
    cleanup,
    authorizedCharacterIds,
    advancedCharacterIds: input.advancedCharacterIds,
    occurredAt: input.occurredAt
  })
  const occurrenceId = await persistNativeConcentrationEnd(ctx, {
    state,
    parentOccurrenceId: input.editCommandId,
    end: {
      ownerActorId: holder.id,
      maintainedStateId: slot.id,
      reason,
      cleanup
    },
    userId: input.userId,
    correlationId: input.editCommandId,
    occurredAt: input.occurredAt
  })
  await postConcentrationEndMessage(ctx, {
    state,
    actor: holder,
    reason,
    occurrenceId,
    userId: input.userId
  })
}
