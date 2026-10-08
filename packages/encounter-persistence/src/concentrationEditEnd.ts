import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { concentrationEndOccurrenceId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import { persistNativeConcentrationEnd } from './actionChildPersistence.js'
import {
  applyLiveConcentrationCleanup,
  deriveLiveConcentrationCleanup
} from './concentrationCleanupPersistence.js'
import { postConcentrationEndMessage, readConcentrationEndReason } from './concentrationEnd.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'

/**
 * Ends the holder's Concentration with no check (D95) when a GM actor edit or a Sheet edit, already
 * written in this transaction, left it defeated or unable to act. The edit's command id stands in
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
    maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
  })
  if (!slot) return
  const reason = await readConcentrationEndReason(ctx, {
    state,
    actor: holder,
    userId: input.userId
  })
  if (!reason) return
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
