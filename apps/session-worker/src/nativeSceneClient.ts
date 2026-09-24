import type { LiveSessionTransientCapture } from '@artificer-toolkit/schema/api/liveSessionTransient'
import type {
  LiveSessionTransientHydrationAuthority,
  LiveSessionTransientHydrationRequest,
  LiveSessionTransientHydrationResultByKind
} from '@artificer-toolkit/schema/api/liveSessionTransientHydration'
import type { SceneCurrentEntityPage } from '@artificer-toolkit/schema/api/sceneRecipient'
import type { SceneFogChunksPage, SceneFogLayersPage } from '@artificer-toolkit/schema/api/sceneFog'
import {
  sceneFogLayerDtoSchema,
  campaignSceneStateDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneSessionVisionCompositionSchema,
  type SceneSessionCharacterVisionInput,
  type SceneSessionCharacterVisionResult,
  type SceneSessionVisionComposition,
  type SceneSessionVisionBindingsPage,
  type SceneSessionVisionRun,
  type SceneSessionVisionRunsPage,
  type SceneSessionVisionScope
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import { resolveSceneCharacterVision } from '@artificer-toolkit/shared/vtt'

import {
  callLiveSessionRoute,
  LiveSessionRouteError,
  type NativeLiveSessionEnvironment
} from './liveSessionRoutes.js'

const entityCollections = [
  'annotations',
  'barriers',
  'darknessZones',
  'lights',
  'tokens',
  'measurements'
] as const

function authority(capture: LiveSessionTransientCapture): LiveSessionTransientHydrationAuthority {
  return {
    campaignId: capture.campaignId,
    expectedRole: capture.origin.role,
    expectedUserId: capture.origin.userId
  }
}

async function hydrate(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture,
  requestInput: Extract<LiveSessionTransientHydrationRequest, { kind: 'ENTITIES' }>
): Promise<SceneCurrentEntityPage>
async function hydrate(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture,
  requestInput: Extract<LiveSessionTransientHydrationRequest, { kind: 'FOG_LAYERS' }>
): Promise<SceneFogLayersPage>
async function hydrate(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture,
  requestInput: Extract<LiveSessionTransientHydrationRequest, { kind: 'FOG_CHUNKS' }>
): Promise<SceneFogChunksPage>
async function hydrate(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture,
  requestInput: Extract<LiveSessionTransientHydrationRequest, { kind: 'VISION_RUNS' }>
): Promise<SceneSessionVisionRunsPage>
async function hydrate(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture,
  requestInput: Extract<LiveSessionTransientHydrationRequest, { kind: 'VISION_BINDINGS' }>
): Promise<SceneSessionVisionBindingsPage>
async function hydrate(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture,
  requestInput: Extract<LiveSessionTransientHydrationRequest, { kind: 'VISION_CHARACTER' }>
): Promise<SceneSessionCharacterVisionResult>
async function hydrate(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture,
  requestInput: LiveSessionTransientHydrationRequest
): Promise<
  LiveSessionTransientHydrationResultByKind[keyof LiveSessionTransientHydrationResultByKind]
> {
  const response = await callLiveSessionRoute(environment, accessToken, 'hydrate', {
    authority: authority(capture),
    request: requestInput
  })
  if (response.kind !== requestInput.kind) throw new LiveSessionRouteError(200)
  return response.result
}

function sameScope(left: SceneSessionVisionScope, right: SceneSessionVisionScope): boolean {
  return (
    left.campaignId === right.campaignId &&
    left.systemId === right.systemId &&
    left.sceneId === right.sceneId &&
    left.expectedSceneVersion === right.expectedSceneVersion &&
    left.expectedPresentationVersion === right.expectedPresentationVersion &&
    left.freshness.system === right.freshness.system &&
    left.freshness.campaign === right.freshness.campaign &&
    left.freshness.play === right.freshness.play
  )
}

async function loadEntities(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture,
  collection: (typeof entityCollections)[number]
): Promise<SceneCurrentEntityPage['page']> {
  const header = capture.sceneHeader
  if (!header) throw new LiveSessionRouteError(0)
  const result: SceneCurrentEntityPage['page'] = []
  const ids = new Set<string>()
  const cursors = new Set<string>()
  let next: { phase: 'BASE' | 'APPENDED'; afterOrdinal: number | null } | null = {
    phase: 'BASE',
    afterOrdinal: null
  }
  while (next) {
    const key = `${next.phase}:${next.afterOrdinal ?? ''}`
    if (cursors.has(key)) throw new LiveSessionRouteError(200)
    cursors.add(key)
    const page: SceneCurrentEntityPage = await hydrate(environment, accessToken, capture, {
      kind: 'ENTITIES',
      sceneId: header.id,
      definitionSaveId: header.definitionSaveId,
      expectedVersion: header.version,
      collection,
      phase: next.phase,
      afterOrdinal: next.afterOrdinal,
      numItems: 8
    })
    if (page.version !== header.version || page.collection !== collection)
      throw new LiveSessionRouteError(200)
    for (const row of page.page) {
      if (row.value.collection !== collection || ids.has(row.value.entity.id))
        throw new LiveSessionRouteError(200)
      ids.add(row.value.entity.id)
      result.push(row)
    }
    next = page.next
  }
  if (result.length !== header.currentCounts[collection]) throw new LiveSessionRouteError(200)
  return result
}

async function loadFogLayers(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture
): Promise<CampaignSceneStateDto['fogLayers']> {
  const header = capture.sceneHeader
  if (!header) throw new LiveSessionRouteError(0)
  const layers: CampaignSceneStateDto['fogLayers'] = []
  const owners = new Set<string | null>()
  const ordinals = new Set<number>()
  const cursors = new Set<string | null>()
  let cursor: string | null = null
  for (;;) {
    if (cursors.has(cursor)) throw new LiveSessionRouteError(200)
    cursors.add(cursor)
    const page: SceneFogLayersPage = await hydrate(environment, accessToken, capture, {
      kind: 'FOG_LAYERS',
      sceneId: header.id,
      expectedVersion: header.version,
      paginationOpts: { cursor, numItems: 8 }
    })
    if (page.version !== header.version || page.pageStatus === 'SplitRequired')
      throw new LiveSessionRouteError(200)
    for (const layer of page.page) {
      if (owners.has(layer.ownerUserId) || ordinals.has(layer.ordinal))
        throw new LiveSessionRouteError(200)
      owners.add(layer.ownerUserId)
      ordinals.add(layer.ordinal)
      const chunks = [] as CampaignSceneStateDto['fogLayers'][number]['chunks']
      const chunkIndexes = new Set<number>()
      let offset = 0
      for (;;) {
        const chunkPage = await hydrate(environment, accessToken, capture, {
          kind: 'FOG_CHUNKS',
          sceneId: header.id,
          expectedVersion: header.version,
          ownerUserId: layer.ownerUserId,
          offset,
          numItems: 8
        })
        if (
          chunkPage.version !== header.version ||
          chunkPage.ownerUserId !== layer.ownerUserId ||
          chunkPage.width !== layer.width ||
          chunkPage.height !== layer.height ||
          chunkPage.nextOffset !== offset + chunkPage.page.length ||
          (!chunkPage.isDone && chunkPage.nextOffset <= offset)
        )
          throw new LiveSessionRouteError(200)
        for (const chunk of chunkPage.page) {
          if (chunkIndexes.has(chunk.index)) throw new LiveSessionRouteError(200)
          chunkIndexes.add(chunk.index)
          chunks.push(chunk)
        }
        if (chunks.length > layer.chunkCount) throw new LiveSessionRouteError(200)
        if (chunkPage.isDone) {
          if (chunks.length !== layer.chunkCount) throw new LiveSessionRouteError(200)
          layers.push(
            sceneFogLayerDtoSchema.parse({
              chunks,
              height: layer.height,
              ownerUserId: layer.ownerUserId,
              width: layer.width
            })
          )
          break
        }
        offset = chunkPage.nextOffset
      }
    }
    if (page.isDone) break
    if (page.continueCursor === cursor) throw new LiveSessionRouteError(200)
    cursor = page.continueCursor
  }
  if (layers.length !== header.fogLayerCount) throw new LiveSessionRouteError(200)
  return layers
}

async function loadVision(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture,
  scene: CampaignSceneStateDto
): Promise<SceneSessionVisionComposition> {
  const header = capture.sceneHeader
  const presentation = capture.presentation
  const freshness = capture.visionFreshness
  if (!header || !presentation || !freshness || presentation.sceneId !== header.id)
    throw new LiveSessionRouteError(200)
  const scope: SceneSessionVisionScope = {
    campaignId: capture.campaignId,
    expectedPresentationVersion: presentation.version,
    expectedSceneVersion: header.version,
    freshness,
    sceneId: header.id,
    systemId: capture.systemId
  }
  const selectedTokens = new Set(
    scene.tokens.filter((token) => !token.vision).map((token) => token.id)
  )
  if (selectedTokens.size === 0)
    return sceneSessionVisionCompositionSchema.parse({
      characterRevisions: [],
      context: { characterVisions: [], encounterCharacterBindings: [] }
    })
  const bindings = new Map<string, SceneSessionCharacterVisionInput>()
  const runCursors = new Set<string | null>()
  let runCursor: string | null = null
  while (runCursor !== null || runCursors.size === 0) {
    if (runCursors.has(runCursor)) throw new LiveSessionRouteError(200)
    runCursors.add(runCursor)
    const runPage: SceneSessionVisionRunsPage = await hydrate(environment, accessToken, capture, {
      kind: 'VISION_RUNS',
      ...scope,
      paginationOpts: { cursor: runCursor, numItems: 4 }
    })
    if (runPage.pageStatus === 'SplitRequired') throw new LiveSessionRouteError(200)
    for (const run of runPage.page) {
      if (!sameScope(scope, run)) throw new LiveSessionRouteError(200)
      await loadVisionBindings(environment, accessToken, capture, run, selectedTokens, bindings)
    }
    if (runPage.isDone) break
    if (runPage.continueCursor === runCursor) throw new LiveSessionRouteError(200)
    runCursor = runPage.continueCursor
  }
  const selectedBindings = scene.tokens
    .map((token) => bindings.get(token.id))
    .filter((binding): binding is SceneSessionCharacterVisionInput => binding !== undefined)
  const characterResults = new Map<string, Awaited<ReturnType<typeof hydrateVisionCharacter>>>()
  for (const binding of selectedBindings) {
    if (!characterResults.has(binding.characterId))
      characterResults.set(
        binding.characterId,
        await hydrateVisionCharacter(environment, accessToken, capture, binding)
      )
  }
  return sceneSessionVisionCompositionSchema.parse({
    characterRevisions: [...characterResults.values()].map(({ binding, characterRevision }) => ({
      characterId: binding.characterId,
      revision: characterRevision
    })),
    context: {
      characterVisions: [...characterResults.values()].map(
        ({ characterVision }) => characterVision
      ),
      encounterCharacterBindings: selectedBindings.map(
        ({ encounterId, actorId, characterId, tokenId }) => ({
          encounterId,
          actorId,
          characterId,
          tokenId
        })
      )
    }
  })
}

async function loadVisionBindings(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture,
  run: SceneSessionVisionRun,
  selectedTokens: ReadonlySet<string>,
  bindings: Map<string, SceneSessionCharacterVisionInput>
): Promise<void> {
  const cursors = new Set<string | null>()
  let cursor: string | null = null
  while (cursor !== null || cursors.size === 0) {
    if (cursors.has(cursor)) throw new LiveSessionRouteError(200)
    cursors.add(cursor)
    const page: SceneSessionVisionBindingsPage = await hydrate(environment, accessToken, capture, {
      kind: 'VISION_BINDINGS',
      ...run,
      paginationOpts: { cursor, numItems: 4 }
    })
    if (page.pageStatus === 'SplitRequired') throw new LiveSessionRouteError(200)
    for (const binding of page.page) {
      if (!selectedTokens.has(binding.tokenId)) continue
      const existing = bindings.get(binding.tokenId)
      if (!existing || binding.encounterId.localeCompare(existing.encounterId) >= 0)
        bindings.set(binding.tokenId, binding)
    }
    if (page.isDone) break
    if (page.continueCursor === cursor) throw new LiveSessionRouteError(200)
    cursor = page.continueCursor
  }
}

async function hydrateVisionCharacter(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture,
  binding: SceneSessionCharacterVisionInput
) {
  const result = await hydrate(environment, accessToken, capture, {
    kind: 'VISION_CHARACTER',
    ...binding
  })
  if (
    result.binding.encounterId !== binding.encounterId ||
    result.binding.actorId !== binding.actorId ||
    result.binding.characterId !== binding.characterId ||
    result.binding.tokenId !== binding.tokenId
  )
    throw new LiveSessionRouteError(200)
  return result
}

export async function hydrateNativeTransientScene(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  capture: LiveSessionTransientCapture
): Promise<{
  scene: CampaignSceneStateDto | null
  characterRevisions: SceneSessionVisionComposition['characterRevisions']
}> {
  if (!capture.sceneHeader) return { characterRevisions: [], scene: null }
  let uncomposedScene: CampaignSceneStateDto
  if (capture.sceneSnapshot) {
    uncomposedScene = capture.sceneSnapshot
  } else {
    const pages = await Promise.all(
      entityCollections.map((collection) =>
        loadEntities(environment, accessToken, capture, collection)
      )
    )
    const entities = new Map(
      entityCollections.map((collection, index) => [collection, pages[index]!])
    )
    const barriers = entities.get('barriers')!
    const doorStates: CampaignSceneStateDto['doorStates'] = {}
    for (const row of barriers) {
      if (row.value.collection === 'barriers' && row.value.entity.kind === 'DOOR') {
        if (row.doorState === null) throw new LiveSessionRouteError(200)
        doorStates[row.value.entity.id] = row.doorState
      }
    }
    const fogLayers = await loadFogLayers(environment, accessToken, capture)
    const {
      counts: _counts,
      currentCounts: _currentCounts,
      definitionSaveId: _definitionSaveId,
      fogLayerCount: _fogLayerCount,
      ...header
    } = capture.sceneHeader
    uncomposedScene = campaignSceneStateDtoSchema.parse({
      ...header,
      annotations: entities.get('annotations')!.map((row) => row.value.entity),
      barriers: barriers.map((row) => row.value.entity),
      darknessZones: entities.get('darknessZones')!.map((row) => row.value.entity),
      doorStates,
      fogLayers,
      lights: entities.get('lights')!.map((row) => row.value.entity),
      measurements: entities.get('measurements')!.map((row) => row.value.entity),
      tokens: entities.get('tokens')!.map((row) => row.value.entity)
    })
  }
  const composition = await loadVision(environment, accessToken, capture, uncomposedScene)
  return {
    characterRevisions: composition.characterRevisions,
    scene: resolveSceneCharacterVision(
      uncomposedScene,
      composition.context.encounterCharacterBindings,
      composition.context.characterVisions
    )
  }
}
