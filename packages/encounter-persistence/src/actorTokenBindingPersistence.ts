import {
  encounterActorTokenBindingCommandInputDtoSchema,
  type EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  encounterActorTokenBindingSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SpatialSceneToken } from '@artificer-toolkit/shared/vtt'
import { readRunActors, readRunState } from './documents.js'
import { rejectDomain } from './domainRejections.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import type { EncounterPersistenceTransaction } from './ports.js'
import {
  encounterReplayReceipt,
  readEncounterReplayReceipt,
  replayEncounterCommandResult
} from './replayReceipts.js'
import {
  deleteActorPassiveZones,
  placeEncounterPassiveZones,
  type EncounterPassiveZoneReaders
} from './placedSpatialEffects.js'
import { insertRunCommand } from './timelineEntries.js'

/**
 * Binds or unbinds an Encounter actor's Scene token; the host reads its own Scene state. In a
 * prepared or active Run the actor's passive zones follow its token (D144, D147): a bind places
 * them on the new token and an unbind deletes them.
 */
export async function executeEncounterActorTokenBinding(
  ctx: EncounterPersistenceTransaction,
  args: EncounterActorTokenBindingCommandInputDto,
  callbacks: {
    readScene(
      sceneId: string
    ): Promise<Pick<SceneLiveStateHeader, 'id' | 'campaignId' | 'grid'> | null>
    readToken(sceneId: string, tokenId: string): Promise<SpatialSceneToken | null>
  } & Pick<EncounterPassiveZoneReaders, 'readCharacterRules'>
): Promise<EncounterCommandResultDto> {
  const input = encounterActorTokenBindingCommandInputDtoSchema.parse({
    ...args,
    commandId: args.commandId.toLowerCase(),
    encounterId: args.encounterId.toLowerCase(),
    actorId: args.actorId.toLowerCase(),
    sceneId: args.sceneId.toLowerCase(),
    ...(args.type === 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
      ? { tokenId: args.tokenId.toLowerCase() }
      : {})
  })
  const { userId } = await ctx.ports.requireIdentity()
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (run.gameSystemId !== campaign.gameSystemId)
    throw new Error('Encounter does not match the Campaign Game System.')
  const state = readRunState(run)
  const fingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.commandType !== input.type ||
      prior.encounterId !== run.id ||
      prior.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    const storedInput = encounterActorTokenBindingCommandInputDtoSchema.parse(
      JSON.parse(prior.commandJson)
    )
    const replayReceipt = readEncounterReplayReceipt(prior)
    if (
      checksumCanonicalJson(storedInput) !== fingerprint ||
      prior.version !== input.expectedEncounterVersion + 1 ||
      prior.version > run.version ||
      replayReceipt.roll !== null ||
      replayReceipt.occurrence !== null
    )
      throw new Error('Stored Encounter command receipt mismatch.')
    return replayEncounterCommandResult(ctx, state, prior)
  }
  // A completed Run has no history to replay and no binding to change (ADR 0035 Amendment 30).
  if (run.status === 'COMPLETED') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  if (input.expectedEncounterVersion !== run.version)
    rejectDomain('VERSION_STALE', 'Encounter changed before its Scene binding could update.')
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
    .take(1)
  if (pending.length) rejectDomain('PENDING_DECISION', 'Encounter rule resolution is pending.')
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
    .unique()
  if (!binding || binding.campaignId !== campaign.id || binding.sceneId !== input.sceneId)
    rejectDomain('SCENE_NOT_PRESENTED', 'Encounter Scene binding was not found.')
  const scene = await callbacks.readScene(input.sceneId)
  if (!scene || scene.campaignId !== campaign.id)
    throw new Error('Campaign live Scene was not found.')
  const actors = await readRunActors(ctx, state)
  if (!actors.some((actor) => actor.id === input.actorId))
    throw new Error('Encounter actor was not found.')
  const actorBinding = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_actorId', (q) =>
      q.eq('encounterId', run.id).eq('actorId', input.actorId)
    )
    .unique()
  if (actorBinding && actorBinding.sceneId !== scene.id)
    throw new Error('Stored Encounter actor token binding is inconsistent.')
  const followsToken = run.status === 'PREPARED' || run.status === 'ACTIVE'
  if (followsToken) await deleteActorPassiveZones(ctx, { state, actorId: input.actorId })
  if (input.type === 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING') {
    const token = await callbacks.readToken(scene.id, input.tokenId)
    if (!token) rejectDomain('TARGET_UNAVAILABLE', 'Scene token was not found.')
    const tokenBinding = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_tokenId', (q) =>
        q.eq('encounterId', run.id).eq('tokenId', input.tokenId)
      )
      .unique()
    if (tokenBinding && tokenBinding.sceneId !== scene.id)
      throw new Error('Stored Encounter actor token binding is inconsistent.')
    if (tokenBinding && tokenBinding.actorId !== input.actorId)
      rejectDomain('TARGET_UNAVAILABLE', 'Scene token is already bound to another Encounter actor.')
    const value = encounterActorTokenBindingSchema.parse({
      actorId: input.actorId,
      encounterId: run.id,
      sceneId: scene.id,
      tokenId: input.tokenId
    })
    if (actorBinding) await ctx.db.patch(actorBinding._id, value)
    else await ctx.db.insert('encounterActorTokenBindings', value)
    if (followsToken)
      await placeEncounterPassiveZones(
        ctx,
        {
          state,
          campaign,
          actors: actors.filter((actor) => actor.id === input.actorId),
          occurrenceId: input.commandId,
          rootCommandId: input.commandId
        },
        {
          readScene: async () => ({ grid: scene.grid, tokens: [token] }),
          readCharacterRules: callbacks.readCharacterRules
        }
      )
  } else {
    if (!actorBinding)
      rejectDomain('TARGET_UNAVAILABLE', 'Encounter actor token binding was not found.')
    await ctx.db.delete(actorBinding._id)
  }
  const now = new Date().toISOString()
  const version = run.version + 1
  const nextState = { ...state, version, updatedAt: now }
  await ctx.db.patch(run._id, {
    version,
    updatedAt: now,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  const result = encounterCommandResultDtoSchema.parse({
    occurrence: null,
    projection: await readEncounterGmProjection(ctx, nextState),
    roll: null
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: input.commandId,
      commandType: input.type,
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
