import { executeEncounterActorTokenBinding } from '@artificer-toolkit/encounter-persistence/actorTokenBindingPersistence'
import { zodToConvex } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  encounterActorTokenBindingCommandInputDtoSchema,
  type EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredInitialStateSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { sceneStoredLiveStateSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { isRoomHeldRun } from '../liveSessions/authorityGuard'
import { encounterWriteTransaction } from './encounterPorts'
import { parseLiveEntity } from '../scenes/liveDocuments'

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
    await requireIdentity(ctx)
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', args.encounterId.toLowerCase()))
      .unique()
    if (run && (await isRoomHeldRun(ctx, run)))
      throw new Error('This Encounter is currently owned by its Campaign live table.')
    return executeEncounterActorTokenBinding(encounterWriteTransaction(ctx), args, {
      readScene: async (sceneId) => {
        const row = await ctx.db
          .query('campaignScenes')
          .withIndex('by_publicId', (q) => q.eq('id', sceneId))
          .unique()
        if (!row) return null
        const { _id, _creationTime, ...scene } = row
        return sceneStoredInitialStateSchema.parse(scene)
      },
      readToken: async (sceneId, tokenId) => {
        const [liveHeadRow, liveTokenRow, scene] = await Promise.all([
          ctx.db
            .query('sceneLiveStates')
            .withIndex('by_sceneId', (q) => q.eq('sceneId', sceneId))
            .unique(),
          ctx.db
            .query('sceneLiveEntities')
            .withIndex('by_sceneId_collection_entityId', (q) =>
              q.eq('sceneId', sceneId).eq('collection', 'tokens').eq('entityId', tokenId)
            )
            .unique(),
          ctx.db
            .query('campaignScenes')
            .withIndex('by_publicId', (q) => q.eq('id', sceneId))
            .unique()
        ])
        let liveVersion = 0
        if (liveHeadRow) {
          const { _id, _creationTime, ...storedHead } = liveHeadRow
          liveVersion = sceneStoredLiveStateSchema.parse(storedHead).version
        }
        const liveToken = liveTokenRow ? parseLiveEntity(liveTokenRow, liveVersion) : null
        if (liveToken)
          return liveToken.value?.collection === 'tokens' ? liveToken.value.entity : null
        if (!scene) return null
        const tokens = await ctx.db
          .query('sceneDefinitionEntities')
          .withIndex('by_saveId_collection_ordinal', (q) =>
            q.eq('saveId', scene.definitionSaveId).eq('value.collection', 'tokens')
          )
          .take(VTT_SCENE_LIMITS.tokens + 1)
        const matches = tokens.filter((row) => row.entityId.toLowerCase() === tokenId)
        if (tokens.length > VTT_SCENE_LIMITS.tokens || matches.length !== 1) return null
        const { _id, _creationTime, ...storedToken } = matches[0]!
        const entity = sceneStoredDefinitionEntitySchema.parse(storedToken)
        if (
          entity.value.collection !== 'tokens' ||
          entity.entityId !== entity.value.entity.id ||
          entity.checksum !== checksumCanonicalJson(entity.value)
        )
          throw new Error('Stored Scene token is inconsistent.')
        return entity.value.entity
      }
    })
  }
})
