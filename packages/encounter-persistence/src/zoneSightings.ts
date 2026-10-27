import type {
  DismissZoneSightingInputDto,
  EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  withZoneSightings,
  withZoneSightingStatus
} from '@artificer-toolkit/rules-runtime/encounterZoneConcealment'
import { rejectDomain } from './domainRejections.js'
import type { EncounterWriteTransaction } from './ports.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'
import type { EncounterWriteContext } from './store.js'
import { executeZoneCommand } from './zoneCommand.js'

/**
 * Records the Characters that first noticed concealed zones (MOVE-3.5) as PROMPTED sightings for
 * the GM. A Character that already knows of a zone or has a sighting of it is skipped, so a replayed
 * evaluation writes nothing. Returns whether any zone changed.
 */
export async function recordZoneSightings(
  ctx: EncounterWriteContext,
  input: {
    encounterId: string
    sceneId: string
    sightings: readonly { spatialEffectId: string; actorId: string }[]
  }
): Promise<boolean> {
  if (!input.sightings.length) return false
  const store = await createSpatialRuleEffectStore(ctx).scope(input)
  if (!store) return false
  let changed = false
  for (const spatialEffectId of new Set(input.sightings.map((entry) => entry.spatialEffectId))) {
    const zone = await store.get(spatialEffectId)
    if (!zone) continue
    const next = withZoneSightings(
      zone.spatialState,
      input.sightings.flatMap((entry) =>
        entry.spatialEffectId === spatialEffectId ? [entry.actorId] : []
      )
    )
    if (next === zone.spatialState) continue
    await store.updateCurrentStateCas({
      id: zone.id,
      expectedVersion: zone.version,
      lifecycle: zone.lifecycle,
      spatialState: next
    })
    changed = true
  }
  return changed
}

/**
 * The GM dismisses a Character's prompted sighting of a concealed zone (MOVE-3.5): the prompt
 * leaves and the zone stays hidden from that Character. The GM's undo prompts it again.
 */
export function dismissZoneSighting(
  ctx: EncounterWriteTransaction,
  command: DismissZoneSightingInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  return executeZoneCommand(
    ctx,
    { ...command, actorId: command.actorId.toLowerCase() },
    userId,
    'DISMISS_ZONE_SIGHTING',
    async ({ actorId }, store, zone) => {
      const prompted = zone.spatialState.concealment?.sightings.some(
        (sighting) => sighting.actorId === actorId && sighting.status === 'PROMPTED'
      )
      const after = withZoneSightingStatus(zone.spatialState, actorId, 'DISMISSED')
      if (!prompted || !after)
        rejectDomain('TARGET_UNAVAILABLE', 'That sighting is no longer waiting on you.')
      await store.updateCurrentStateCas({
        id: zone.id,
        expectedVersion: zone.version,
        lifecycle: zone.lifecycle,
        spatialState: after
      })
      return { spatialEffectId: zone.id, actorId }
    }
  )
}
