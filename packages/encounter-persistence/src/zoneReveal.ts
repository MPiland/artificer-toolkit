import type {
  DestroyZoneLayerInputDto,
  DisarmZoneInputDto,
  EncounterCommandResultDto,
  RevealZoneInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { withZoneRevealedTo } from '@artificer-toolkit/rules-runtime/encounterZoneConcealment'
import { zoneLayerOutOfOrder } from '@artificer-toolkit/rules-runtime/encounterZoneLayerDestruction'
import { rejectDomain } from './domainRejections.js'
import { readRunActors } from './documents.js'
import type { EncounterWriteTransaction } from './ports.js'
import { executeZoneCommand, type Zone, type ZoneStore } from './zoneCommand.js'

/**
 * The GM shows a concealed zone to chosen Characters (MOVE-3.7), after a Search roll or from a
 * sighting prompt. They join the Characters that know of it; the receipt keeps the zone before and
 * after so the GM's undo hides it again.
 */
export function revealZone(
  ctx: EncounterWriteTransaction,
  command: RevealZoneInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  return executeZoneCommand(
    ctx,
    { ...command, actorIds: command.actorIds.map((id) => id.toLowerCase()) },
    userId,
    'REVEAL_ZONE',
    async ({ actorIds }, store, zone, state) => {
      const present = new Set((await readRunActors(ctx, state)).map((actor) => actor.id))
      if (actorIds.some((id) => !present.has(id)))
        rejectDomain('TARGET_UNAVAILABLE', 'A chosen Character is not in the Encounter.')
      const before = zone.spatialState
      const after = withZoneRevealedTo(before, actorIds)
      if (!after) rejectDomain('TARGET_UNAVAILABLE', 'There is no one to reveal that zone to.')
      await store.updateCurrentStateCas({
        id: zone.id,
        expectedVersion: zone.version,
        lifecycle: zone.lifecycle,
        spatialState: after
      })
      return { spatialEffectId: zone.id, before, after }
    }
  )
}

/**
 * The GM disarms a zone fixed to the Scene (MOVE-3.7), which removes it for everyone. The receipt
 * keeps the zone whole so the GM's undo puts it back.
 */
export function disarmZone(
  ctx: EncounterWriteTransaction,
  command: DisarmZoneInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  return executeZoneCommand(ctx, command, userId, 'DISARM_ZONE', async (_input, store, zone) => {
    if (
      zone.placement.anchorKind !== 'FIXED' ||
      zone.maintainedEffectStateId !== null ||
      zone.placement.layerIndex !== undefined
    )
      rejectDomain('TARGET_UNAVAILABLE', 'Only a zone placed on the Scene can be disarmed.')
    return removeZone(store, zone)
  })
}

/**
 * The GM destroys one layer of a layered zone (D223) by what its component authors, which removes
 * it, so it stays destroyed. A zone whose layers fall in order refuses a layer while one before it
 * remains. The receipt keeps the layer whole so the GM's undo puts it back.
 */
export function destroyZoneLayer(
  ctx: EncounterWriteTransaction,
  command: DestroyZoneLayerInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  return executeZoneCommand(
    ctx,
    command,
    userId,
    'DESTROY_ZONE_LAYER',
    async (_input, store, zone) => {
      if (!zone.placement.destruction)
        rejectDomain('TARGET_UNAVAILABLE', 'Nothing authored destroys that zone layer.')
      if (zoneLayerOutOfOrder(zone, await store.list()))
        rejectDomain('TARGET_UNAVAILABLE', 'Destroy the layers before it first.')
      return removeZone(store, zone)
    }
  )
}

/** Removes a zone from the Scene, keeping it whole in the receipt the GM's undo restores. */
async function removeZone(store: ZoneStore, zone: Zone) {
  await store.deleteCas({ id: zone.id, expectedVersion: zone.version })
  const { maintainedEffectStateId, definition, lifecycle, placement, spatialState } = zone
  return {
    spatialEffectId: zone.id,
    maintainedEffectStateId,
    zone: { definition, lifecycle, placement, spatialState }
  }
}
