import type {
  DisarmZoneInputDto,
  EncounterCommandResultDto,
  RevealZoneInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { withZoneRevealedTo } from '@artificer-toolkit/rules-runtime/encounterZoneConcealment'
import { rejectDomain } from './domainRejections.js'
import { readRunActors } from './documents.js'
import type { EncounterWriteTransaction } from './ports.js'
import { executeZoneCommand } from './zoneCommand.js'

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
    if (zone.placement.anchorKind !== 'FIXED' || zone.maintainedEffectStateId !== null)
      rejectDomain('TARGET_UNAVAILABLE', 'Only a zone placed on the Scene can be disarmed.')
    await store.deleteCas({ id: zone.id, expectedVersion: zone.version })
    const { definition, lifecycle, placement, spatialState } = zone
    return { spatialEffectId: zone.id, zone: { definition, lifecycle, placement, spatialState } }
  })
}
