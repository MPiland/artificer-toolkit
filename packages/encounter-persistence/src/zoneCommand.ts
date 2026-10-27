import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { rejectDomain } from './domainRejections.js'
import { readRunState } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import type { EncounterWriteTransaction } from './ports.js'
import { encounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries.js'

type ZoneStore = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createSpatialRuleEffectStore>['scope']>>
>
type Zone = NonNullable<Awaited<ReturnType<ZoneStore['get']>>>

/**
 * Runs one GM command on a zone of the Run's bound Scene (MOVE-3.3, 3.5, 3.7): GM-only, replayed by
 * command id, one Run version bump and one timeline entry. `apply` changes the zone through the
 * store and returns the receipt the GM's undo reads; ids in `command` arrive lower-cased.
 */
export async function executeZoneCommand<
  Command extends {
    encounterId: string
    commandId: string
    expectedVersion: number
    spatialEffectId: string
  },
  Receipt extends object
>(
  ctx: EncounterWriteTransaction,
  command: Command,
  userId: string,
  commandType: 'SET_ZONE_DCS' | 'DISMISS_ZONE_SIGHTING' | 'REVEAL_ZONE' | 'DISARM_ZONE',
  apply: (
    input: Command,
    store: ZoneStore,
    zone: Zone,
    state: EncounterRunState
  ) => Promise<Receipt>
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
      prior.commandType !== commandType ||
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
  const receipt = await apply(input, store, zone, state)

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
      commandType,
      receipt,
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
