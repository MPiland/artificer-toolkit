import { insertRunCommand } from './timelineEntries'
import { zodToConvex } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  encounterActorTokenBindingCommandInputDtoSchema,
  type EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterActorTokenBindingSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { sceneStoredLiveStateSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { mutation } from '../lib/mutations'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { readRunActors, readRunProjection, readRunState } from './documents'
import { parseLiveEntity } from '../scenes/liveDocuments'
import { rejectDomain } from '../lib/domainRejections'

const inputValidator: Validator<EncounterActorTokenBindingCommandInputDto, 'required', string> =
  zodToConvex<z.core.$ZodType<EncounterActorTokenBindingCommandInputDto>>(
    encounterActorTokenBindingCommandInputDtoSchema
  )
const resultValidator: Validator<EncounterCommandResultDto, 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterCommandResultDto>
>(encounterCommandResultDtoSchema)

export const execute = mutation({
  args: { input: inputValidator },
  returns: resultValidator,
  handler: async (ctx, { input: args }): Promise<EncounterCommandResultDto> => {
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
    const { userId } = await requireIdentity(ctx)
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
      .unique()
    if (!run) throw new Error('Encounter is unavailable.')
    const { campaign, membership } = await requireCampaignAuthority(ctx, run.campaignId, userId)
    if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
    if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
    if (run.gameSystemId !== campaign.gameSystemId)
      throw new Error('Encounter does not match the Campaign Game System.')
    const state = readRunState(run)
    const projection = readRunProjection(run)
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
      const result = encounterCommandResultDtoSchema.parse(JSON.parse(prior.resultJson))
      const historical = encounterGmProjectionDtoSchema.parse(result.projection)
      if (
        checksumCanonicalJson(storedInput) !== fingerprint ||
        checksumCanonicalJson(result) !== prior.resultChecksum ||
        historical.id !== run.id ||
        historical.campaignId !== campaign.id ||
        historical.gameSystemId !== campaign.gameSystemId ||
        historical.version !== prior.version ||
        historical.version !== input.expectedEncounterVersion + 1 ||
        result.roll !== null ||
        result.resolution !== null ||
        result.occurrence !== null
      )
        throw new Error('Stored Encounter command receipt mismatch.')
      return result
    }
    if (input.expectedEncounterVersion !== run.version)
      throw new Error('Encounter changed before its Scene binding could update.')
    if (run.status === 'COMPLETED')
      throw new Error('Completed Encounters cannot change Scene bindings.')
    const pending = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
      .take(1)
    if (pending.length) throw new Error('Encounter rule resolution is pending.')
    const binding = await ctx.db
      .query('encounterSceneBindings')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
      .unique()
    if (!binding || binding.campaignId !== campaign.id || binding.sceneId !== input.sceneId)
      throw new Error('Encounter Scene binding was not found.')
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', input.sceneId))
      .unique()
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
    if (input.type === 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING') {
      const [liveHeadRow, liveTokenRow] = await Promise.all([
        ctx.db
          .query('sceneLiveStates')
          .withIndex('by_sceneId', (q) => q.eq('sceneId', scene.id))
          .unique(),
        ctx.db
          .query('sceneLiveEntities')
          .withIndex('by_sceneId_collection_entityId', (q) =>
            q.eq('sceneId', scene.id).eq('collection', 'tokens').eq('entityId', input.tokenId)
          )
          .unique()
      ])
      let liveVersion = 0
      if (liveHeadRow) {
        const { _id, _creationTime, ...storedHead } = liveHeadRow
        liveVersion = sceneStoredLiveStateSchema.parse(storedHead).version
      }
      const liveToken = liveTokenRow ? parseLiveEntity(liveTokenRow, liveVersion) : null
      if (liveToken) {
        if (!liveToken.value) throw new Error('Scene token was not found.')
      } else {
        const tokens = await ctx.db
          .query('sceneDefinitionEntities')
          .withIndex('by_saveId_collection_ordinal', (q) =>
            q.eq('saveId', scene.definitionSaveId).eq('value.collection', 'tokens')
          )
          .take(VTT_SCENE_LIMITS.tokens + 1)
        const matches = tokens.filter((row) => row.entityId.toLowerCase() === input.tokenId)
        if (tokens.length > VTT_SCENE_LIMITS.tokens || matches.length !== 1)
          throw new Error('Scene token was not found.')
        const { _id, _creationTime, ...storedToken } = matches[0]!
        const entity = sceneStoredDefinitionEntitySchema.parse(storedToken)
        if (
          entity.value.collection !== 'tokens' ||
          entity.entityId !== entity.value.entity.id ||
          entity.checksum !== checksumCanonicalJson(entity.value)
        )
          throw new Error('Stored Scene token is inconsistent.')
      }
      const tokenBinding = await ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_tokenId', (q) =>
          q.eq('encounterId', run.id).eq('tokenId', input.tokenId)
        )
        .unique()
      if (tokenBinding && tokenBinding.sceneId !== scene.id)
        throw new Error('Stored Encounter actor token binding is inconsistent.')
      if (tokenBinding && tokenBinding.actorId !== input.actorId)
        throw new Error('Scene token is already bound to another Encounter actor.')
      const value = encounterActorTokenBindingSchema.parse({
        actorId: input.actorId,
        encounterId: run.id,
        sceneId: scene.id,
        tokenId: input.tokenId
      })
      if (actorBinding) await ctx.db.patch(actorBinding._id, value)
      else await ctx.db.insert('encounterActorTokenBindings', value)
    } else {
      if (!actorBinding) throw new Error('Encounter actor token binding was not found.')
      await ctx.db.delete(actorBinding._id)
    }
    const now = new Date().toISOString()
    const version = run.version + 1
    const nextState = { ...state, version, updatedAt: now }
    const nextProjection = { ...projection, version, updatedAt: now }
    const result = encounterCommandResultDtoSchema.parse({
      occurrence: null,
      projection: nextProjection,
      resolution: null,
      roll: null
    })
    await ctx.db.patch(run._id, {
      version,
      updatedAt: now,
      stateJson: JSON.stringify(nextState),
      stateChecksum: checksumCanonicalJson(nextState),
      projectionJson: JSON.stringify(nextProjection),
      projectionChecksum: checksumCanonicalJson(nextProjection)
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
        resultJson: JSON.stringify(result),
        resultChecksum: checksumCanonicalJson(result),
        createdAt: now
      })
    )
    return result
  }
})
