import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { z } from 'zod'
import { encounterSceneActorTokenBindingDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneEncounterBindingInputSchema,
  sceneEncounterBindingSchema,
  sceneRecipientEncounterBindingsLookupInputSchema,
  type SceneEncounterBinding
} from '@artificer-toolkit/schema/api/sceneRecipient'
import {
  presentSceneEncounterBinding,
  readBoundEncounterScene
} from '@artificer-toolkit/encounter-persistence/sceneBindingReads'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { QueryCtx } from '../_generated/server'
import { internalQuery, query } from '../lib/queries'
import { readRecipientContext } from '../scenes/recipientContext'
import { encounterReadTransaction } from './encounterReadPorts'
import { readMemberEncounter } from './readAccess'

async function readBoundSceneScope(
  ctx: QueryCtx,
  input: {
    encounterId: string
    sceneId: string
    expectedEncounterVersion?: number
    expectedVersion?: number
  }
) {
  const { run, campaign, userId } = await readMemberEncounter(ctx, input.encounterId)
  const { binding, scene } = await readBoundEncounterScene(
    encounterReadTransaction(ctx),
    {
      run,
      campaign,
      sceneId: input.sceneId,
      expectedEncounterVersion: input.expectedEncounterVersion
    },
    {
      readScene: async () =>
        (await readRecipientContext(ctx, input.sceneId, input.expectedVersion, userId)).capture,
      readPresentedSceneId: async () =>
        (
          await ctx.db
            .query('campaignScenePresentations')
            .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
            .unique()
        )?.sceneId ?? null
    }
  )
  return { run, capture: scene, binding }
}

export const get = query({
  args: zodToConvexFields(sceneEncounterBindingInputSchema.shape),
  returns: zodToConvex(z.nullable(sceneEncounterBindingSchema)),
  handler: async (ctx, args): Promise<SceneEncounterBinding | null> => {
    const input = sceneEncounterBindingInputSchema.parse(args)
    const { run, binding } = await readBoundSceneScope(ctx, input)
    return presentSceneEncounterBinding(run, binding)
  }
})

export const forVisibleTokens = internalQuery({
  args: zodToConvexFields(sceneRecipientEncounterBindingsLookupInputSchema.shape),
  returns: zodToConvex(z.array(encounterSceneActorTokenBindingDtoSchema).check(z.maxLength(8))),
  handler: async (ctx, args) => {
    const input = sceneRecipientEncounterBindingsLookupInputSchema.parse(args)
    const { run, capture, binding } = await readBoundSceneScope(ctx, input)
    if (binding === null) throw new Error('Encounter is not bound to this presented Scene.')
    if (checksumCanonicalJson(capture) !== input.expectedRecipientRevision)
      throw new Error('Scene recipient authority changed before binding hydration.')
    const bindings: ReturnType<typeof encounterSceneActorTokenBindingDtoSchema.parse>[] = []
    for (const tokenId of input.tokenIds) {
      const row = await ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_tokenId', (q) =>
          q.eq('encounterId', run.id).eq('tokenId', tokenId)
        )
        .unique()
      if (!row) continue
      const tokenBinding = encounterSceneActorTokenBindingDtoSchema.parse({
        actorId: row.actorId,
        encounterId: row.encounterId,
        sceneId: row.sceneId,
        tokenId: row.tokenId
      })
      if (
        tokenBinding.encounterId !== run.id ||
        tokenBinding.sceneId !== input.sceneId ||
        tokenBinding.tokenId !== tokenId
      )
        throw new Error('Encounter actor token binding is inconsistent.')
      bindings.push(tokenBinding)
    }
    return bindings
  }
})
