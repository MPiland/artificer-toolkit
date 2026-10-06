import type { ConvexReactClient } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  sceneEncounterBindingSchema,
  sceneRecipientHeaderSchema,
  sceneRecipientEncounterBindingsInputSchema,
  sceneRecipientEncounterBindingsPageSchema,
  type SceneRecipientHeader,
  type SceneRecipientEncounterBindingsPage
} from '@artificer-toolkit/schema/api/sceneRecipient'
import {
  sceneFogChunksPageSchema,
  sceneFogLayersPageSchema,
  type SceneFogLayersPage
} from '@artificer-toolkit/schema/api/sceneFog'
import {
  campaignSceneStateDtoSchema,
  sceneFogLayerDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'

function aborted(signal?: AbortSignal) {
  signal?.throwIfAborted()
}

/**
 * Convex's Encounter bindings for a Run the room does not hold, so Convex owns them. The Scene header
 * is read once, only for the version and revision the pages fence on; it is not subscribed.
 */
export async function loadCampaignSceneEncounterBindings(
  client: ConvexReactClient,
  rawBinding: unknown,
  signal?: AbortSignal
) {
  const binding = sceneEncounterBindingSchema.parse(rawBinding)
  const header = sceneRecipientHeaderSchema.parse(
    await client.query(api.scenes.recipientReads.header, {
      sceneId: binding.sceneId,
      includeSnapshot: false
    })
  )
  const bindings: SceneRecipientEncounterBindingsPage['page'] = []
  const actorIds = new Set<string>()
  const tokenIds = new Set<string>()
  const cursors = new Set<string | null>()
  let afterEntityId: string | null = null
  for (;;) {
    aborted(signal)
    if (cursors.has(afterEntityId))
      throw new Error('Encounter Scene binding pagination did not advance.')
    cursors.add(afterEntityId)
    const page = sceneRecipientEncounterBindingsPageSchema.parse(
      await client.action(api.scenes.recipientActions.encounterBindings, {
        ...sceneRecipientEncounterBindingsInputSchema.parse({
          afterEntityId,
          encounterId: binding.encounterId,
          expectedEncounterVersion: binding.encounterVersion,
          expectedRecipientRevision: header.recipientRevision,
          expectedVersion: header.version,
          numItems: 8,
          sceneId: header.id
        })
      })
    )
    aborted(signal)
    if (
      page.sceneId !== header.id ||
      page.version !== header.version ||
      page.recipientRevision !== header.recipientRevision ||
      page.encounterId !== binding.encounterId ||
      page.encounterVersion !== binding.encounterVersion
    )
      throw new Error('Encounter Scene binding page is inconsistent.')
    for (const row of page.page) {
      if (
        row.encounterId !== binding.encounterId ||
        row.sceneId !== header.id ||
        actorIds.has(row.actorId) ||
        tokenIds.has(row.tokenId)
      )
        throw new Error('Encounter Scene binding page is inconsistent.')
      actorIds.add(row.actorId)
      tokenIds.add(row.tokenId)
      bindings.push(row)
    }
    if (page.next === null) break
    if (page.next === afterEntityId)
      throw new Error('Encounter Scene binding pagination did not advance.')
    afterEntityId = page.next
  }
  aborted(signal)
  const [finalBinding, finalHeader] = await Promise.all([
    client.query(api.encounters.sceneBindings.get, {
      encounterId: binding.encounterId,
      sceneId: header.id
    }),
    client.query(api.scenes.recipientReads.header, {
      sceneId: header.id,
      includeSnapshot: false
    })
  ])
  aborted(signal)
  const parsedFinalBinding =
    finalBinding === null ? null : sceneEncounterBindingSchema.parse(finalBinding)
  const parsedFinalHeader = sceneRecipientHeaderSchema.parse(finalHeader)
  if (
    !parsedFinalBinding ||
    parsedFinalBinding.encounterId !== binding.encounterId ||
    parsedFinalBinding.encounterVersion !== binding.encounterVersion ||
    parsedFinalBinding.sceneId !== header.id ||
    parsedFinalHeader.id !== header.id ||
    parsedFinalHeader.version !== header.version ||
    parsedFinalHeader.recipientRevision !== header.recipientRevision
  )
    throw new Error('Encounter Scene binding authority changed before hydration completed.')
  return bindings
}

async function loadFogLayers(
  client: ConvexReactClient,
  header: SceneRecipientHeader,
  signal?: AbortSignal
) {
  const fogLayers: CampaignSceneStateDto['fogLayers'] = []
  const owners = new Set<string | null>()
  const ordinals = new Set<number>()
  const cursors = new Set<string | null>()
  let cursor: string | null = null
  for (;;) {
    aborted(signal)
    if (cursors.has(cursor)) throw new Error('Scene recipient fog pagination did not advance.')
    cursors.add(cursor)
    const page = sceneFogLayersPageSchema.parse(
      await client.query(api.scenes.fogReads.layers, {
        sceneId: header.id,
        expectedVersion: header.version,
        paginationOpts: { cursor, numItems: 8 }
      })
    )
    aborted(signal)
    if (page.version !== header.version || page.pageStatus === 'SplitRequired')
      throw new Error('Scene recipient fog headers could not be hydrated completely.')
    for (const layer of page.page) {
      if (owners.has(layer.ownerUserId) || ordinals.has(layer.ordinal))
        throw new Error('Scene recipient fog layers are inconsistent.')
      owners.add(layer.ownerUserId)
      ordinals.add(layer.ordinal)
      fogLayers.push(await loadFogLayer(client, header, layer, signal))
    }
    if (page.isDone) return fogLayers
    if (page.continueCursor === cursor)
      throw new Error('Scene recipient fog pagination did not advance.')
    cursor = page.continueCursor
  }
}

async function loadFogLayer(
  client: ConvexReactClient,
  header: SceneRecipientHeader,
  layer: SceneFogLayersPage['page'][number],
  signal?: AbortSignal
) {
  const chunks: CampaignSceneStateDto['fogLayers'][number]['chunks'] = []
  let offset = 0
  for (;;) {
    aborted(signal)
    const page = sceneFogChunksPageSchema.parse(
      await client.query(api.scenes.fogReads.chunks, {
        sceneId: header.id,
        expectedVersion: header.version,
        ownerUserId: layer.ownerUserId,
        offset,
        numItems: 8
      })
    )
    aborted(signal)
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
    if (page.isDone) {
      if (chunks.length !== layer.chunkCount)
        throw new Error('Scene recipient fog chunk count is inconsistent.')
      return sceneFogLayerDtoSchema.parse({
        ownerUserId: layer.ownerUserId,
        width: layer.width,
        height: layer.height,
        chunks
      })
    }
    offset = page.nextOffset
  }
}

/**
 * D87: a Scene shown as a view-only image reads only its header and fog. Entities stay behind the
 * presented-Scene gate, so they are never requested and the Scene carries none.
 */
export async function loadCampaignShownScene(
  client: ConvexReactClient,
  header: SceneRecipientHeader,
  signal?: AbortSignal
) {
  const fogLayers = await loadFogLayers(client, header, signal)
  const { recipientRevision: _recipientRevision, snapshot: _snapshot, ...scene } = header
  return campaignSceneStateDtoSchema.parse({
    ...scene,
    annotations: [],
    barriers: [],
    darknessZones: [],
    lights: [],
    tokens: [],
    measurements: [],
    doorStates: {},
    fogLayers
  })
}
