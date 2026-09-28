import { makeFunctionReference } from 'convex/server'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  sceneSessionCharacterVisionInputSchema,
  sceneSessionCharacterVisionResultSchema,
  sceneSessionVisionCaptureInputSchema,
  sceneSessionVisionScopeSchema,
  sceneSessionVisionBindingsInputSchema,
  sceneSessionVisionBindingsPageSchema,
  sceneSessionVisionRunsInputSchema,
  sceneSessionVisionRunsPageSchema,
  type SceneSessionCharacterVisionResult,
  type SceneSessionCharacterVisionInput,
  type SceneSessionVisionBindingsPage,
  type SceneSessionVisionRun,
  type SceneSessionVisionRunsPage,
  type SceneSessionVisionScope,
  sceneSessionVisionRunSchema
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import type {
  CharacterMechanicsReadInput,
  CharacterSceneVisionResult
} from '@artificer-toolkit/schema/api/characterMechanicsRead'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { requireCampaignCharacterAuthority } from '../campaigns/characterState'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readSceneVisionRevision } from './visionFreshness'
import { readSessionVisionScope } from './sessionVisionDocuments'

const readCharacterVision = makeFunctionReference<
  'query',
  CharacterMechanicsReadInput,
  CharacterSceneVisionResult
>('characters/sceneVision:read')

export const capture = internalQuery({
  args: zodToConvex(sceneSessionVisionCaptureInputSchema),
  returns: zodToConvex(sceneSessionVisionScopeSchema),
  handler: async (ctx, args): Promise<SceneSessionVisionScope> => {
    const input = sceneSessionVisionCaptureInputSchema.parse(args)
    const { freshness } = await readSessionVisionScope(ctx, input)
    return { ...input, freshness }
  }
})

async function readSessionVisionRun(
  ctx: QueryCtx,
  scope: Awaited<ReturnType<typeof readSessionVisionScope>>,
  input: SceneSessionVisionRun
) {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (
    !run ||
    run.campaignId !== scope.campaign.id ||
    run.gameSystemId !== input.systemId ||
    run.version !== input.expectedEncounterVersion
  )
    throw new Error('Scene vision Encounter identity or version is stale.')
  const state = readRunState(run)
  const sceneBinding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
    .unique()
  if (sceneBinding?.campaignId !== scope.campaign.id || sceneBinding.sceneId !== scope.header.id)
    throw new Error('Scene vision Encounter binding is unavailable.')
  return { run, state }
}

export const runs = internalQuery({
  args: zodToConvex(sceneSessionVisionRunsInputSchema),
  returns: zodToConvex(sceneSessionVisionRunsPageSchema),
  handler: async (ctx, args): Promise<SceneSessionVisionRunsPage> => {
    const input = sceneSessionVisionRunsInputSchema.parse(args)
    const { paginationOpts, ...scopeInput } = input
    const scope = await readSessionVisionScope(ctx, scopeInput)
    const result = await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', scope.campaign.id))
      .paginate({
        // This action scan reads at most four documents, independent of reactive page ranges.
        cursor: paginationOpts.cursor,
        numItems: Math.min(paginationOpts.numItems, 4)
      })
    const page: SceneSessionVisionRun[] = []
    for (const run of result.page) {
      if (run.campaignId !== scope.campaign.id || run.gameSystemId !== input.systemId)
        throw new Error('Scene vision Encounter identity is inconsistent.')
      readRunState(run)
      const sceneBinding = await ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
        .unique()
      if (!sceneBinding) continue
      if (sceneBinding.campaignId !== scope.campaign.id)
        throw new Error('Scene vision Encounter binding is inconsistent.')
      if (sceneBinding.sceneId !== scope.header.id) continue
      page.push(
        sceneSessionVisionRunSchema.parse({
          ...scopeInput,
          encounterId: run.id,
          expectedEncounterVersion: run.version
        })
      )
    }
    return sceneSessionVisionRunsPageSchema.parse({ ...result, page })
  }
})

export const bindings = internalQuery({
  args: zodToConvex(sceneSessionVisionBindingsInputSchema),
  returns: zodToConvex(sceneSessionVisionBindingsPageSchema),
  handler: async (ctx, args): Promise<SceneSessionVisionBindingsPage> => {
    const input = sceneSessionVisionBindingsInputSchema.parse(args)
    const { paginationOpts, ...runInput } = input
    const scope = await readSessionVisionScope(ctx, runInput)
    const { run, state } = await readSessionVisionRun(ctx, scope, runInput)
    const result = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', run.id))
      .paginate({
        cursor: paginationOpts.cursor,
        numItems: Math.min(paginationOpts.numItems, 4)
      })
    const page: SceneSessionCharacterVisionInput[] = []
    for (const tokenBinding of result.page) {
      if (tokenBinding.sceneId !== scope.header.id)
        throw new Error('Scene vision actor token binding is inconsistent.')
      const actor = await readRunActor(ctx, state, tokenBinding.actorId)
      if (actor.kind !== 'CHARACTER') continue
      const characterId = actor.sourceId
      if (!characterId) throw new Error('Scene vision Character actor source is unavailable.')

      const { assignment } = await requireCampaignCharacterAuthority(
        ctx,
        scope.campaign.id,
        characterId,
        // The authenticated member may hydrate current facts; source access remains owner-derived.
        scope.campaign.ownerUserId
      )
      const character = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', characterId))
        .unique()
      if (
        !character ||
        character.id !== assignment.characterId ||
        character.userId !== assignment.userId ||
        character.systemId !== runInput.systemId
      )
        throw new Error('Scene vision Character identity is inconsistent.')
      page.push(
        sceneSessionCharacterVisionInputSchema.parse({
          ...runInput,
          characterId: character.id,
          streamVersion: character.streamVersion,
          actorId: actor.id,
          tokenId: tokenBinding.tokenId
        })
      )
    }
    return sceneSessionVisionBindingsPageSchema.parse({ ...result, page })
  }
})

/** Admission and current Character vision share this query's database snapshot. */
export const character = internalQuery({
  args: zodToConvex(sceneSessionCharacterVisionInputSchema),
  returns: zodToConvex(sceneSessionCharacterVisionResultSchema),
  handler: async (ctx, args): Promise<SceneSessionCharacterVisionResult> => {
    const input = sceneSessionCharacterVisionInputSchema.parse(args)
    const scope = await readSessionVisionScope(ctx, input)
    const { run, state } = await readSessionVisionRun(ctx, scope, input)
    const actor = await readRunActor(ctx, state, input.actorId)
    if (actor.kind !== 'CHARACTER' || actor.sourceId !== input.characterId)
      throw new Error('Scene vision actor does not reference this Character.')
    const tokenBinding = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) =>
        q.eq('encounterId', run.id).eq('actorId', actor.id)
      )
      .unique()
    if (tokenBinding?.sceneId !== scope.header.id || tokenBinding.tokenId !== input.tokenId)
      throw new Error('Scene vision actor token binding is unavailable.')

    const characterVision = await ctx.runQuery(readCharacterVision, {
      campaignId: scope.campaign.id,
      characterId: input.characterId,
      systemId: input.systemId,
      streamVersion: input.streamVersion
    })
    const characterRevision = await readSceneVisionRevision(ctx, 'CHARACTER', input.characterId)
    const binding = {
      encounterId: run.id,
      actorId: actor.id,
      characterId: input.characterId,
      tokenId: input.tokenId
    }
    return sceneSessionCharacterVisionResultSchema.parse({
      binding,
      characterVision,
      characterRevision,
      snapshotChecksum: checksumCanonicalJson({
        input,
        binding,
        characterVision,
        characterRevision,
        runChecksum: run.stateChecksum
      })
    })
  }
})
