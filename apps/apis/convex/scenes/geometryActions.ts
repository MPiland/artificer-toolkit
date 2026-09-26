'use node'

import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneGeometryCommandResultSchema,
  sceneGeometryBeginResultSchema,
  sceneGeometryExecuteInputSchema,
  sceneGeometrySaveLookupSchema,
  type SceneGeometryBeginResult,
  type SceneGeometryCommandResult,
  type SceneGeometryExecuteInput,
  type SceneGeometryPage,
  type SceneGeometryPageInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneFogLayerDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import type { SceneFogLayersPage, SceneFogChunksPage } from '@artificer-toolkit/schema/api/sceneFog'
import {
  applySceneGeometryDelta,
  deriveSceneCommandFogLayer,
  planSceneCommandExploration,
  sceneTokenMovementFailure
} from '@artificer-toolkit/shared/vtt'
import {
  VTT_SCENE_LIMITS,
  type SceneToken,
  type SceneBarrier,
  type SceneDoorState,
  type SceneFogChunk
} from '@artificer-toolkit/shared/vtt/scene'
import { makeFunctionReference } from 'convex/server'
import { sliceMovementPath } from '@artificer-toolkit/rules-runtime/encounterMovementPath'
import { action, type ActionCtx } from '../_generated/server'
import { internal } from '../_generated/api'
import { geometryTarget } from './geometryValues'
import { loadSceneSessionVision } from './sessionVisionComposition'

const geometryBeginReference = makeFunctionReference<
  'mutation',
  SceneGeometryExecuteInput,
  SceneGeometryBeginResult
>('scenes/geometryStaging:begin')

export const execute = action({
  args: zodToConvexFields(sceneGeometryExecuteInputSchema.shape),
  returns: zodToConvex(sceneGeometryCommandResultSchema),
  handler: async (ctx, args): Promise<SceneGeometryCommandResult> => {
    const input = sceneGeometryExecuteInputSchema.parse(args)
    const begin: SceneGeometryBeginResult = sceneGeometryBeginResultSchema.parse(
      await ctx.runMutation(geometryBeginReference, input)
    )
    if (begin.kind === 'REPLAY') return begin.result
    return completeSceneGeometry(ctx, begin)
  }
})

/** Hydrates the Scene and stages the command's fog before atomic Scene publication. */
export async function completeSceneGeometry(
  ctx: Pick<ActionCtx, 'runQuery' | 'runMutation'>,
  begin: Extract<SceneGeometryBeginResult, { kind: 'READY' }>
): Promise<SceneGeometryCommandResult> {
  const { header, input } = begin
  let saveId = begin.saveId
  const target = geometryTarget(input)
  const tokens: SceneToken[] = []
  const barriers: SceneBarrier[] = []
  const doorStates: Record<string, SceneDoorState> = {}
  let baseOrdinal: number | null = null
  for (const collection of ['tokens', 'barriers'] as const) {
    let next: SceneGeometryPage['next'] = { phase: 'BASE', afterOrdinal: null }
    const ids = new Set<string>()
    const ordinals = new Set<number>()
    while (next) {
      const request: SceneGeometryPageInput = {
        sceneId: header.id,
        definitionSaveId: header.definitionSaveId,
        expectedVersion: header.version,
        collection,
        numItems: 8,
        ...next
      }
      const result: SceneGeometryPage = await ctx.runQuery(
        internal.scenes.geometryReads.entities,
        request
      )
      if (result.version !== header.version || result.collection !== collection)
        throw new Error('Live Scene snapshot changed before geometry hydration.')
      for (const entry of result.page) {
        const { value, ordinal } = entry
        if (value.collection !== collection || ids.has(value.entity.id) || ordinals.has(ordinal))
          throw new Error('Stored Scene geometry identities or ordinals are inconsistent.')
        ids.add(value.entity.id)
        ordinals.add(ordinal)
        if (
          collection === target.collection &&
          value.entity.id === target.entityId &&
          ordinal < header.counts[collection]
        )
          baseOrdinal = ordinal
        if (value.collection === 'tokens') tokens.push(value.entity)
        else {
          barriers.push(value.entity)
          if (value.entity.kind === 'DOOR') {
            if (entry.doorState === null)
              throw new Error('Stored Scene door state is inconsistent.')
            doorStates[value.entity.id] = entry.doorState
          }
        }
      }
      if (ids.size > header.currentCounts[collection])
        throw new Error('Stored Scene geometry count is inconsistent.')
      if (
        result.next &&
        ((request.phase === 'APPENDED' && result.next.phase === 'BASE') ||
          (request.phase === result.next.phase &&
            (result.next.afterOrdinal ?? -1) <= (request.afterOrdinal ?? -1)))
      )
        throw new Error('Scene geometry pagination did not advance.')
      next = result.next
    }
    if (ids.size !== header.currentCounts[collection])
      throw new Error('Stored Scene geometry count is inconsistent.')
  }
  const prior = {
    map: header.map,
    grid: header.grid,
    fogMode: header.fogMode,
    tokens,
    barriers,
    doorStates
  }
  const delta = target.delta
  // Exploration follows the walked path; begin refused Encounter-bound moves (D43).
  const movementPath =
    input.type === 'MOVE_SCENE_TOKEN'
      ? sliceMovementPath(input.path, 0, Number.POSITIVE_INFINITY)
      : null
  if (input.type === 'MOVE_SCENE_TOKEN' && movementPath) {
    const first = movementPath[0]!
    const token = prior.tokens.find((entry) => entry.id === input.tokenId)
    if (!token || Math.hypot(token.position.x - first.x, token.position.y - first.y) > 1e-8)
      throw new Error('Movement does not begin at the current token position.')
    const failure =
      movementPath.length > 1
        ? sceneTokenMovementFailure(prior, input.tokenId, movementPath.at(-1)!, movementPath)
        : null
    if (failure) throw new Error(failure)
  }
  const after = applySceneGeometryDelta(prior, delta)
  if (
    after.tokens.length > VTT_SCENE_LIMITS.tokens ||
    after.barriers.length > VTT_SCENE_LIMITS.barriers
  )
    throw new Error('Scene geometry exceeds the supported entity count.')
  const vision = begin.sessionVision
    ? await loadSceneSessionVision(ctx, begin.sessionVision, after.tokens)
    : undefined
  if (vision) {
    const observed = sceneGeometrySaveLookupSchema.parse(
      await ctx.runMutation(internal.scenes.geometryStaging.observe, {
        saveId,
        characterRevisions: vision.characterRevisions
      })
    )
    saveId = observed.saveId
  }
  const plan = planSceneCommandExploration(prior, after, delta, vision?.context)
  if (plan.owners.length > 0) {
    const layers = new Map<string | null, SceneFogLayersPage['page'][number]>()
    const layerOrdinals = new Set<number>()
    let cursor: string | null = null
    do {
      const page: SceneFogLayersPage = await ctx.runQuery(
        internal.scenes.transientFogReads.layers,
        {
          sceneId: header.id,
          expectedVersion: header.version,
          paginationOpts: { cursor, numItems: 8 }
        }
      )
      if (page.version !== header.version || page.pageStatus === 'SplitRequired')
        throw new Error('Scene fog headers could not be hydrated completely.')
      for (const layer of page.page) {
        if (layers.has(layer.ownerUserId) || layerOrdinals.has(layer.ordinal))
          throw new Error('Stored Scene fog layer identities are inconsistent.')
        layers.set(layer.ownerUserId, layer)
        layerOrdinals.add(layer.ordinal)
      }
      if (layers.size > header.fogLayerCount || (!page.isDone && page.continueCursor === cursor))
        throw new Error('Scene fog header pagination is inconsistent.')
      cursor = page.isDone ? null : page.continueCursor
    } while (cursor !== null)
    if (layers.size !== header.fogLayerCount)
      throw new Error('Stored Scene fog layer count is inconsistent.')
    // One recipient layer at a time keeps large manual fog histories out of the action's aggregate state.
    for (const ownerUserId of plan.owners) {
      const existing = layers.get(ownerUserId)
      const chunks: SceneFogChunk[] = []
      if (existing) {
        let offset = 0
        let done = false
        while (!done) {
          const page: SceneFogChunksPage = await ctx.runQuery(
            internal.scenes.transientFogReads.chunks,
            {
              sceneId: header.id,
              ownerUserId,
              expectedVersion: header.version,
              offset,
              numItems: 8
            }
          )
          if (
            page.version !== header.version ||
            page.ownerUserId !== ownerUserId ||
            page.width !== existing.width ||
            page.height !== existing.height ||
            page.nextOffset !== offset + page.page.length ||
            (!page.isDone && page.nextOffset <= offset)
          )
            throw new Error('Scene fog chunk pagination is inconsistent.')
          chunks.push(...page.page)
          if (chunks.length > existing.chunkCount)
            throw new Error('Stored Scene fog chunk count is inconsistent.')
          offset = page.nextOffset
          done = page.isDone
        }
        if (chunks.length !== existing.chunkCount)
          throw new Error('Stored Scene fog chunk count is inconsistent.')
      }
      const layer = deriveSceneCommandFogLayer(plan, {
        ownerUserId,
        existing: existing
          ? sceneFogLayerDtoSchema.parse({
              ownerUserId,
              width: existing.width,
              height: existing.height,
              chunks
            })
          : null,
        ...(input.type === 'MOVE_SCENE_TOKEN'
          ? { movement: { tokenId: input.tokenId, path: movementPath! } }
          : {})
      })
      if (layer) await ctx.runMutation(internal.scenes.geometryStaging.stageFog, { saveId, layer })
    }
  }
  return sceneGeometryCommandResultSchema.parse(
    await ctx.runMutation(internal.scenes.geometryCommands.finish, { saveId, baseOrdinal })
  )
}
