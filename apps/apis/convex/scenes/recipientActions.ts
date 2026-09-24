'use node'

import { makeFunctionReference } from 'convex/server'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneRecipientPageInputSchema,
  sceneRecipientPageSchema,
  sceneRecipientCaptureSchema,
  sceneRecipientEncounterBindingsInputSchema,
  sceneRecipientEncounterBindingsPageSchema,
  type SceneRecipientCapture,
  type SceneRecipientEncounterBindingsLookupInput,
  type SceneRecipientEncounterBindingsPage,
  type SceneRecipientPage,
  type SceneCurrentEntityPage
} from '@artificer-toolkit/schema/api/sceneRecipient'
import type { EncounterSceneActorTokenBindingDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { SceneFogLayersPage, SceneFogChunksPage } from '@artificer-toolkit/schema/api/sceneFog'
import { sceneFogLayerDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { isSceneEntityVisibleToViewer } from '@artificer-toolkit/shared/vtt'
import type { SceneFogLayer, SceneFogChunk } from '@artificer-toolkit/shared/vtt/scene'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { action } from '../_generated/server'
import { api, internal } from '../_generated/api'

const readVisibleEncounterBindings = makeFunctionReference<
  'query',
  SceneRecipientEncounterBindingsLookupInput,
  EncounterSceneActorTokenBindingDto[]
>('encounters/sceneBindings:forVisibleTokens')

export const entities = action({
  args: zodToConvexFields(sceneRecipientPageInputSchema.shape),
  returns: zodToConvex(sceneRecipientPageSchema),
  handler: async (ctx, args): Promise<SceneRecipientPage> => {
    const input = sceneRecipientPageInputSchema.parse(args)
    const captureInput = { sceneId: input.sceneId, expectedVersion: input.expectedVersion }
    const captured: SceneRecipientCapture = sceneRecipientCaptureSchema.parse(
      await ctx.runQuery(internal.scenes.recipientReads.capture, captureInput)
    )
    const recipientRevision = checksumCanonicalJson(captured)
    if (input.expectedRecipientRevision !== recipientRevision)
      throw new Error('Scene recipient authority changed before hydration began.')
    const { header, viewer } = captured
    const fogLayers: SceneFogLayer[] = []
    if (viewer.role === 'PLAYER' && input.collection !== 'measurements') {
      let cursor: string | null = null
      const owners = new Set<string | null>()
      const ordinals = new Set<number>()
      do {
        const layers: SceneFogLayersPage = await ctx.runQuery(api.scenes.fogReads.layers, {
          ...captureInput,
          paginationOpts: { cursor, numItems: 8 }
        })
        if (layers.version !== header.version || layers.pageStatus === 'SplitRequired')
          throw new Error('Scene recipient fog headers could not be hydrated completely.')
        for (const layer of layers.page) {
          if (
            (layer.ownerUserId !== null && layer.ownerUserId !== viewer.userId) ||
            owners.has(layer.ownerUserId) ||
            ordinals.has(layer.ordinal)
          )
            throw new Error('Scene recipient fog layers are inconsistent.')
          owners.add(layer.ownerUserId)
          ordinals.add(layer.ordinal)
          const chunks: SceneFogChunk[] = []
          let offset = 0
          let done = false
          while (!done) {
            const page: SceneFogChunksPage = await ctx.runQuery(api.scenes.fogReads.chunks, {
              ...captureInput,
              ownerUserId: layer.ownerUserId,
              offset,
              numItems: 8
            })
            if (
              page.version !== header.version ||
              page.ownerUserId !== layer.ownerUserId ||
              page.width !== layer.width ||
              page.height !== layer.height ||
              page.nextOffset !== offset + page.page.length ||
              (!page.isDone && page.nextOffset <= offset)
            )
              throw new Error('Scene recipient fog chunk pagination is inconsistent.')
            chunks.push(...page.page)
            if (chunks.length > layer.chunkCount)
              throw new Error('Scene recipient fog chunk count is inconsistent.')
            offset = page.nextOffset
            done = page.isDone
          }
          if (chunks.length !== layer.chunkCount)
            throw new Error('Scene recipient fog chunk count is inconsistent.')
          fogLayers.push(
            sceneFogLayerDtoSchema.parse({
              ownerUserId: layer.ownerUserId,
              width: layer.width,
              height: layer.height,
              chunks
            })
          )
        }
        if (!layers.isDone && layers.continueCursor === cursor)
          throw new Error('Scene recipient fog pagination did not advance.')
        cursor = layers.isDone ? null : layers.continueCursor
      } while (cursor !== null)
    }
    const page: SceneRecipientPage['page'] = []
    let next: SceneCurrentEntityPage['next'] = { phase: 'BASE', afterOrdinal: null }
    let foundCursor = input.afterEntityId === null
    let hasMore = false
    // ponytail: visible-ID cursors rescan bounded current collections; index cursor resolution if paging latency requires it.
    while (next && !hasMore) {
      const request = next
      const current: SceneCurrentEntityPage = await ctx.runQuery(
        internal.scenes.recipientReads.currentEntities,
        {
          sceneId: header.id,
          expectedVersion: header.version,
          definitionSaveId: header.definitionSaveId,
          collection: input.collection,
          numItems: 8,
          ...request
        }
      )
      for (const { value, doorState } of current.page) {
        if (!isSceneEntityVisibleToViewer({ map: header.map, fogLayers }, viewer, value)) continue
        if (!foundCursor) {
          foundCursor = value.entity.id === input.afterEntityId
          continue
        }
        if (page.length === input.numItems) {
          hasMore = true
          break
        }
        page.push({ value, doorState })
      }
      if (
        current.next &&
        request.phase === current.next.phase &&
        (current.next.afterOrdinal ?? -1) <= (request.afterOrdinal ?? -1)
      )
        throw new Error('Scene recipient entity pagination did not advance.')
      next = current.next
    }
    if (!foundCursor) throw new Error('Scene recipient continuation is unavailable.')
    // The final read fences membership changes as well as entity/fog changes across action reads.
    const final: SceneRecipientCapture = sceneRecipientCaptureSchema.parse(
      await ctx.runQuery(internal.scenes.recipientReads.capture, captureInput)
    )
    if (checksumCanonicalJson(final) !== checksumCanonicalJson(captured))
      throw new Error('Scene recipient authority changed before hydration completed.')
    return sceneRecipientPageSchema.parse({
      version: header.version,
      collection: input.collection,
      page,
      next: hasMore ? page.at(-1)!.value.entity.id : null,
      recipientRevision
    })
  }
})

export const encounterBindings = action({
  args: zodToConvexFields(sceneRecipientEncounterBindingsInputSchema.shape),
  returns: zodToConvex(sceneRecipientEncounterBindingsPageSchema),
  handler: async (ctx, args): Promise<SceneRecipientEncounterBindingsPage> => {
    const input = sceneRecipientEncounterBindingsInputSchema.parse(args)
    const { encounterId, expectedEncounterVersion, ...recipientInput } = input
    const visible = sceneRecipientPageSchema.parse(
      await ctx.runAction(api.scenes.recipientActions.entities, {
        ...recipientInput,
        collection: 'tokens'
      })
    )
    const page = await ctx.runQuery(readVisibleEncounterBindings, {
      ...recipientInput,
      encounterId,
      expectedEncounterVersion,
      tokenIds: visible.page.map(({ value }) => value.entity.id)
    })
    return sceneRecipientEncounterBindingsPageSchema.parse({
      sceneId: recipientInput.sceneId,
      version: recipientInput.expectedVersion,
      recipientRevision: recipientInput.expectedRecipientRevision,
      encounterId,
      encounterVersion: expectedEncounterVersion,
      page,
      next: visible.next
    })
  }
})
