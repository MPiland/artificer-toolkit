import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto,
  type SetZoneDcsInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { withZoneDcs } from '@artificer-toolkit/rules-runtime/encounterZoneConcealment'
import { rejectDomain } from './domainRejections.js'
import { readRunState } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import type { EncounterWriteTransaction } from './ports.js'
import { encounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries.js'

/**
 * The GM sets or clears a placed zone's spot DC and disarm DC (MOVE-3.3). A spot DC conceals the
 * zone from every player whose Characters do not know of it; its placer knows of it. The receipt
 * keeps the zone's state before and after, so the GM's undo restores it past later sightings.
 */
export async function setZoneDcs(
  ctx: EncounterWriteTransaction,
  command: SetZoneDcsInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  const input = {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase(),
    spatialEffectId: command.spatialEffectId.toLowerCase()
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
      prior.commandType !== 'SET_ZONE_DCS' ||
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
  if (!store || !zone) rejectDomain('TARGET_UNAVAILABLE', 'That zone is no longer on the Scene.')
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
      commandType: 'SET_ZONE_DCS',
      receipt: { spatialEffectId: zone.id, before, after: updated.spatialState },
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
