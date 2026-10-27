import type {
  EncounterCommandResultDto,
  SetZoneDcsInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { withZoneDcs } from '@artificer-toolkit/rules-runtime/encounterZoneConcealment'
import { rejectDomain } from './domainRejections.js'
import type { EncounterWriteTransaction } from './ports.js'
import { executeZoneCommand } from './zoneCommand.js'

/**
 * The GM sets or clears a placed zone's spot DC and disarm DC (MOVE-3.3). A spot DC conceals the
 * zone from every player whose Characters do not know of it; its placer knows of it. The receipt
 * keeps the zone's state before and after, so the GM's undo restores it past later sightings.
 */
export function setZoneDcs(
  ctx: EncounterWriteTransaction,
  command: SetZoneDcsInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  return executeZoneCommand(ctx, command, userId, 'SET_ZONE_DCS', async (input, store, zone) => {
    if (zone.placement.anchorKind !== 'FIXED')
      rejectDomain('TARGET_UNAVAILABLE', 'Only a zone fixed to the Scene has a spot or disarm DC.')
    const { origin } = zone.definition
    const before = zone.spatialState
    const after = withZoneDcs(before, {
      spotDc: input.spotDc,
      disarmDc: input.disarmDc,
      placerActorId: origin.kind === 'ENCOUNTER' ? origin.sourceActorId : null
    })
    if (checksumCanonicalJson(after) === checksumCanonicalJson(before))
      rejectDomain('TARGET_UNAVAILABLE', "That does not change the zone's DCs.")
    const updated = await store.updateCurrentStateCas({
      id: zone.id,
      expectedVersion: zone.version,
      lifecycle: zone.lifecycle,
      spatialState: after
    })
    return { spatialEffectId: zone.id, before, after: updated.spatialState }
  })
}
