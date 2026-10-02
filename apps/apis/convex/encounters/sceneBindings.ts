import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { z } from 'zod'
import {
  bindEncounterToPresentedSceneInputDtoSchema,
  bindEncounterToPresentedSceneResultDtoSchema,
  encounterSceneActorTokenBindingDtoSchema,
  type BindEncounterToPresentedSceneInputDto,
  type BindEncounterToPresentedSceneResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneEncounterBindingInputSchema,
  sceneEncounterBindingSchema,
  sceneRecipientEncounterBindingsLookupInputSchema,
  type SceneEncounterBinding
} from '@artificer-toolkit/schema/api/sceneRecipient'
import { bindEncounterToPresentedScene as persistSceneBinding } from '@artificer-toolkit/encounter-persistence/sceneBindingPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { mutation } from '../lib/mutations'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { internalQuery, query } from '../lib/queries'
import { readRecipientContext } from '../scenes/recipientContext'
import { assertConvexOwnsSceneLiveState } from '../liveSessions/authorityGuard'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

async function readBoundSceneScope(
  ctx: QueryCtx,
  input: {
    encounterId: string
    sceneId: string
    expectedEncounterVersion?: number
    expectedVersion?: number
  }
) {
  const { userId } = await requireIdentity(ctx)
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign } = await requireCampaignAuthority(ctx, run.campaignId, userId)
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (run.gameSystemId !== campaign.gameSystemId)
    throw new Error('Encounter does not match the Campaign Game System.')
  if (
    input.expectedEncounterVersion !== undefined &&
    run.version !== input.expectedEncounterVersion
  )
    rejectDomain('VERSION_STALE')
  readRunState(run)

  const { capture } = await readRecipientContext(ctx, input.sceneId, input.expectedVersion, userId)
  if (capture.header.campaignId !== campaign.id)
    throw new Error('Encounter and Scene Campaign identity does not match.')
  const presentation = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .unique()
  if (presentation?.sceneId !== input.sceneId) throw new Error('Scene presentation is stale.')
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
    .unique()
  if (binding && (binding.encounterId !== run.id || binding.campaignId !== campaign.id))
    throw new Error('Encounter Scene binding is inconsistent.')
  const bound = binding?.sceneId === input.sceneId ? binding : null
  if (bound)
    sceneEncounterBindingSchema.parse({
      encounterId: run.id,
      encounterVersion: run.version,
      sceneId: bound.sceneId
    })
  return { run, capture, binding: bound }
}

export const get = query({
  args: zodToConvexFields(sceneEncounterBindingInputSchema.shape),
  returns: zodToConvex(z.nullable(sceneEncounterBindingSchema)),
  handler: async (ctx, args): Promise<SceneEncounterBinding | null> => {
    const input = sceneEncounterBindingInputSchema.parse(args)
    const { run, binding } = await readBoundSceneScope(ctx, input)
    return binding === null
      ? null
      : sceneEncounterBindingSchema.parse({
          encounterId: run.id,
          encounterVersion: run.version,
          sceneId: binding.sceneId
        })
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

/**
 * Binds an Encounter to its Campaign's presented Scene (GM only); the same command replays its
 * result. Convex must own the Scene's live state; a live room binds natively in its own storage.
 */
async function bindEncounterToPresentedScene(
  ctx: MutationCtx,
  args: BindEncounterToPresentedSceneInputDto
): Promise<BindEncounterToPresentedSceneResultDto> {
  return persistSceneBinding(
    {
      db: createConvexEncounterStore(ctx),
      ports: {
        requireIdentity: () => requireIdentity(ctx),
        requireCampaignAuthority: (campaignId, userId) =>
          requireCampaignAuthority(ctx, campaignId, userId)
      }
    },
    args,
    null,
    {
      readPresentation: (campaignId) =>
        ctx.db
          .query('campaignScenePresentations')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
          .unique(),
      readScene: (sceneId) =>
        ctx.db
          .query('campaignScenes')
          .withIndex('by_publicId', (q) => q.eq('id', sceneId))
          .unique(),
      assertOutsideRoom: (campaignId, sceneId) =>
        assertConvexOwnsSceneLiveState(ctx, campaignId, sceneId)
    }
  )
}

/** Binds without a room; a live room owns its presented Scene, so the GM binds through it (D47). */
export const bind = mutation({
  args: zodToConvex(bindEncounterToPresentedSceneInputDtoSchema),
  returns: zodToConvex(bindEncounterToPresentedSceneResultDtoSchema),
  handler: (ctx, args): Promise<BindEncounterToPresentedSceneResultDto> =>
    bindEncounterToPresentedScene(ctx, args)
})
