import {
  encounterCommandResultDtoSchema,
  type DismissZoneSightingInputDto,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  withZoneSightings,
  withZoneSightingStatus
} from '@artificer-toolkit/rules-runtime/encounterZoneConcealment'
import { rejectDomain } from './domainRejections.js'
import { readRunState } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import type { EncounterWriteTransaction } from './ports.js'
import { encounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'
import type { EncounterWriteContext } from './store.js'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries.js'

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
export async function dismissZoneSighting(
  ctx: EncounterWriteTransaction,
  command: DismissZoneSightingInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  const input = {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase(),
    spatialEffectId: command.spatialEffectId.toLowerCase(),
    actorId: command.actorId.toLowerCase()
  }
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const fingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.commandType !== 'DISMISS_ZONE_SIGHTING' ||
      prior.encounterId !== run.id ||
      prior.actorUserId !== userId ||
      prior.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    return replayEncounterCommandResult(ctx, readRunState(run), prior)
  }
  if (run.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  const state = readRunState(run)
  if (state.status !== 'ACTIVE') rejectDomain('ENCOUNTER_NOT_ACTIVE')

  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  const store =
    binding &&
    (await createSpatialRuleEffectStore(ctx).scope({
      encounterId: state.id,
      sceneId: binding.sceneId
    }))
  const zone = await store?.get(input.spatialEffectId)
  const prompted = zone?.spatialState.concealment?.sightings.some(
    (sighting) => sighting.actorId === input.actorId && sighting.status === 'PROMPTED'
  )
  const after = zone && withZoneSightingStatus(zone.spatialState, input.actorId, 'DISMISSED')
  if (!store || !zone || !prompted || !after)
    rejectDomain('TARGET_UNAVAILABLE', 'That sighting is no longer waiting on you.')
  await store.updateCurrentStateCas({
    id: zone.id,
    expectedVersion: zone.version,
    lifecycle: zone.lifecycle,
    spatialState: after
  })

  const now = new Date().toISOString()
  const version = run.version + 1
  const nextState = encounterRunStateSchema.parse({ ...state, version, updatedAt: now })
  await ctx.db.patch(run._id, {
    version,
    updatedAt: now,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection: await readEncounterGmProjection(ctx, nextState),
    roll: null,
    occurrence: null
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: input.commandId,
      commandType: 'DISMISS_ZONE_SIGHTING',
      receipt: { spatialEffectId: zone.id, actorId: input.actorId },
      commandFingerprint: fingerprint,
      actorUserId: userId,
      version,
      commandJson: JSON.stringify(input),
      ...encounterReplayReceipt(result),
      createdAt: now
    })
  )
  return result
}
