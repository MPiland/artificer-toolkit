import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { withZoneSightingStatus } from '@artificer-toolkit/rules-runtime/encounterZoneConcealment'
import { readRunActors } from './documents.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { commitRevert, type RevertScope, type StoredCommand } from './revertCommit.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'
import { revertUnavailable } from './targetMechanicsInverse.js'

/**
 * Undoes the GM's spot and disarm DCs while the zone is as that command left it but for sightings
 * (MOVE-3.5). Sightings recorded since stay while the zone stays concealed.
 */
export async function revertZoneDcs(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & { root: Extract<StoredCommand, { commandType: 'SET_ZONE_DCS' }> }
): Promise<EncounterCommandResultDto> {
  const { state, root } = input
  const { spatialEffectId, before, after } = root.receipt
  const { store, current } = await readRevertZone(ctx, state, spatialEffectId)
  const withoutSightings = ({ concealment, ...rest }: typeof after) =>
    checksumCanonicalJson({
      ...rest,
      ...(concealment ? { concealment: { ...concealment, sightings: [] } } : {})
    })
  if (!store || !current || withoutSightings(current.spatialState) !== withoutSightings(after))
    revertUnavailable('The zone changed since its DCs were set; adjust manually.')
  const sightings = (current.spatialState.concealment?.sightings ?? []).filter(
    ({ actorId }) => !before.concealment?.knownByActorIds.includes(actorId)
  )
  await store.updateCurrentStateCas({
    id: current.id,
    expectedVersion: current.version,
    lifecycle: current.lifecycle,
    spatialState: before.concealment
      ? { ...before, concealment: { ...before.concealment, sightings } }
      : before
  })
  const actors = await readRunActors(ctx, state)
  return commitRevert(ctx, {
    ...input,
    actors,
    nextActors: [...actors],
    updatedAt: new Date().toISOString()
  })
}

/** Undoes the GM's dismissal of a sighting (MOVE-3.5): the sighting prompts the GM again. */
export async function revertZoneSightingDismissal(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & { root: Extract<StoredCommand, { commandType: 'DISMISS_ZONE_SIGHTING' }> }
): Promise<EncounterCommandResultDto> {
  const { state, root } = input
  const { spatialEffectId, actorId } = root.receipt
  const { store, current } = await readRevertZone(ctx, state, spatialEffectId)
  const prompted = current && withZoneSightingStatus(current.spatialState, actorId, 'PROMPTED')
  if (!store || !current || !prompted)
    revertUnavailable('The zone changed since the sighting was dismissed; adjust manually.')
  await store.updateCurrentStateCas({
    id: current.id,
    expectedVersion: current.version,
    lifecycle: current.lifecycle,
    spatialState: prompted
  })
  const actors = await readRunActors(ctx, state)
  return commitRevert(ctx, {
    ...input,
    actors,
    nextActors: [...actors],
    updatedAt: new Date().toISOString()
  })
}

/** A zone of this Run that an undo restores, with the store scoped to its Scene. */
async function readRevertZone(
  ctx: EncounterCharacterWriteTransaction,
  state: EncounterRunState,
  spatialEffectId: string
) {
  const row = await ctx.db
    .query('encounterSpatialRuleEffects')
    .withIndex('by_publicId', (q) => q.eq('id', spatialEffectId))
    .unique()
  const store =
    row?.encounterId === state.id
      ? await createSpatialRuleEffectStore(ctx).scope({
          encounterId: row.encounterId,
          sceneId: row.sceneId
        })
      : null
  return { store, current: await store?.get(spatialEffectId) }
}
