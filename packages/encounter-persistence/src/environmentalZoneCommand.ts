import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto,
  type PlaceZoneInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { ManifestAuthored } from '@artificer-toolkit/shared/authored'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { CharacterRuleActionUnsupportedCompilationError } from '@artificer-toolkit/rules-runtime/characterRuleActionSystemAdapter'
import { systemAbilityDefinitions } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { planEncounterEnvironmentalZone } from '@artificer-toolkit/rules-runtime/encounterEnvironmentalZone'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'
import { rejectDomain } from './domainRejections.js'
import { readRunState } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { createPlacedSpatialEffect } from './placedSpatialEffects.js'
import type { EncounterWriteTransaction } from './ports.js'
import { encounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries.js'

/**
 * The GM places an environmental zone, such as a pit or a caltrop field, on the Encounter's
 * Scene (MOVE-3.2, ADR 0038). The zone is authored with the same zone node map as an item's or a
 * spell's and resolves as theirs do; the receipt names it, so the GM's undo removes it.
 */
export async function placeEnvironmentalZone(
  ctx: EncounterWriteTransaction,
  command: PlaceZoneInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  const input = {
    ...command,
    encounterId: command.encounterId.toLowerCase(),
    commandId: command.commandId.toLowerCase()
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
      prior.commandType !== 'PLACE_ZONE' ||
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
  if (!binding) rejectDomain('SCENE_NOT_PRESENTED')
  const { header } = await ctx.ports.sceneReaders.readScene(binding.sceneId)
  const system = await ctx.ports.requireSystem(state.gameSystemId)
  let zone
  try {
    zone = planEncounterEnvironmentalZone({
      gameSystemId: state.gameSystemId,
      conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: systemAbilityDefinitions(system),
      // The schema checks the manifest's authored shape; its type is the authored union.
      zone: input.zone as ManifestAuthored,
      point: input.point,
      grid: resolveEncounterSceneGrid({ encounter: state, sceneGrid: header.grid }),
      id: crypto.randomUUID(),
      encounterId: state.id,
      rootCommandId: input.commandId
    })
  } catch (error) {
    if (error instanceof CharacterRuleActionUnsupportedCompilationError)
      rejectDomain('TARGET_UNAVAILABLE', error.message)
    throw error
  }
  await createPlacedSpatialEffect(ctx, {
    encounterId: state.id,
    sceneId: binding.sceneId,
    zone
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
      commandType: 'PLACE_ZONE',
      receipt: { spatialEffectId: zone.id },
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
