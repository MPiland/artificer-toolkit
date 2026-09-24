import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  sceneEncounterBindingSchema,
  sceneRecipientHeaderSchema,
  sceneRecipientEncounterBindingsInputSchema,
  sceneRecipientPageInputSchema
} from '@artificer-toolkit/schema/api/sceneRecipient'
import { sceneFogLayersPageInputSchema } from '@artificer-toolkit/schema/api/sceneFog'
import { loadCampaignLiveScene, loadCampaignSceneEncounterBindings } from './liveScenes'

const campaignId = '00000000-0000-4000-8000-000000000001'
const sceneId = '00000000-0000-4000-8000-000000000002'
const mapId = '00000000-0000-4000-8000-000000000003'
const revision = 'a'.repeat(64)
const encounterId = '00000000-0000-4000-8000-000000000031'
const actorId = '00000000-0000-4000-8000-000000000032'
const tokenId = '00000000-0000-4000-8000-000000000033'

const header = sceneRecipientHeaderSchema.parse({
  id: sceneId,
  campaignId,
  definitionId: '00000000-0000-4000-8000-000000000004',
  definitionVersion: 1,
  version: 2,
  name: 'Courtyard',
  ambientIllumination: 'BRIGHT',
  fogMode: 'PER_PLAYER',
  visionRevealMode: 'ON_DRAG',
  grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
  map: { assetId: mapId, width: 1, height: 1, tileManifestAssetId: null },
  recipientRevision: revision
})

function client() {
  return new ConvexReactClient('https://unit-test.convex.cloud', {
    logger: false
  })
}

function entity(collection: string) {
  const id = {
    annotations: '00000000-0000-4000-8000-000000000011',
    barriers: '00000000-0000-4000-8000-000000000012',
    darknessZones: '00000000-0000-4000-8000-000000000013',
    lights: '00000000-0000-4000-8000-000000000014',
    tokens: '00000000-0000-4000-8000-000000000015',
    measurements: '00000000-0000-4000-8000-000000000016'
  }[collection]!
  if (collection === 'annotations')
    return {
      collection,
      entity: {
        id,
        position: { x: 0, y: 0 },
        text: 'Note',
        visibility: 'TABLE'
      }
    }
  if (collection === 'barriers')
    return {
      collection,
      entity: {
        id,
        kind: 'DOOR',
        a: { x: 0, y: 0 },
        b: { x: 1, y: 0 },
        initialState: 'CLOSED',
        blocksLightWhenClosed: true,
        blocksMovementWhenClosed: true,
        openAngleDegrees: 90
      }
    }
  if (collection === 'darknessZones')
    return {
      collection,
      entity: {
        id,
        polygon: {
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ]
        },
        opacity: 1,
        mechanicalIllumination: null,
        mechanicalObscurement: null
      }
    }
  if (collection === 'lights')
    return {
      collection,
      entity: {
        id,
        kind: 'POINT',
        position: { x: 0, y: 0 },
        brightRadius: 1,
        dimRadius: 2,
        color: '#ffffff',
        intensity: 1
      }
    }
  if (collection === 'tokens')
    return {
      collection,
      entity: {
        id,
        position: { x: 0, y: 0 },
        label: 'Goblin',
        controlledByUserIds: [],
        assetId: null,
        width: 1,
        height: 1,
        hidden: false,
        locked: false,
        rotationDegrees: 0,
        vision: null
      }
    }
  return {
    collection,
    entity: {
      id,
      createdByUserId: campaignId,
      label: null,
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ]
    }
  }
}

function setup(convex: ConvexReactClient, finalHeader = header) {
  vi.spyOn(convex, 'action').mockImplementation(async (...[reference, args]) => {
    expect(getFunctionName(reference)).toBe(getFunctionName(api.scenes.recipientActions.entities))
    const input = sceneRecipientPageInputSchema.parse(args)
    expect(input.expectedRecipientRevision).toBe(revision)
    if (input.collection === 'annotations' && input.afterEntityId === null) {
      const first = entity('annotations')
      return {
        version: header.version,
        recipientRevision: revision,
        collection: input.collection,
        page: [{ value: first, doorState: null }],
        next: first.entity.id
      }
    }
    if (input.collection === 'annotations')
      return {
        version: header.version,
        recipientRevision: revision,
        collection: input.collection,
        page: [
          {
            value: {
              ...entity('annotations'),
              entity: {
                ...entity('annotations').entity,
                id: '00000000-0000-4000-8000-000000000021'
              }
            },
            doorState: null
          }
        ],
        next: null
      }
    return {
      version: header.version,
      recipientRevision: revision,
      collection: input.collection,
      page: [
        {
          value: entity(input.collection),
          doorState: input.collection === 'barriers' ? 'OPEN' : null
        }
      ],
      next: null
    }
  })
  vi.spyOn(convex, 'query').mockImplementation(async (...[reference, args]) => {
    const name = getFunctionName(reference)
    if (name === getFunctionName(api.scenes.recipientReads.header)) {
      expect(args).toEqual({ sceneId, includeSnapshot: false })
      return finalHeader
    }
    if (name === getFunctionName(api.scenes.fogReads.layers)) {
      const input = sceneFogLayersPageInputSchema.parse(args)
      return input.paginationOpts.cursor === null
        ? {
            version: header.version,
            page: [],
            isDone: false,
            continueCursor: 'next',
            pageStatus: null,
            splitCursor: null
          }
        : {
            version: header.version,
            page: [
              {
                ownerUserId: null,
                width: 1,
                height: 1,
                ordinal: 0,
                chunkCount: 1
              }
            ],
            isDone: true,
            continueCursor: '',
            pageStatus: null,
            splitCursor: null
          }
    }
    if (name === getFunctionName(api.scenes.fogReads.chunks))
      return {
        version: header.version,
        ownerUserId: null,
        width: 1,
        height: 1,
        page: [{ index: 0, x: 0, y: 0, width: 1, height: 1, data: 'AA==' }],
        nextOffset: 1,
        isDone: true
      }
    throw new Error(`Unexpected query ${name}`)
  })
}

afterEach(() => vi.restoreAllMocks())

it('assembles six bounded entity collections, door overrides, and fog through continuation pages', async () => {
  const convex = client()
  setup(convex)

  const result = await loadCampaignLiveScene(convex, header)
  const { recipientRevision: _recipientRevision, ...sceneHeader } = header
  expect(result).toMatchObject({
    ...sceneHeader,
    annotations: [entity('annotations').entity, { id: '00000000-0000-4000-8000-000000000021' }],
    doorStates: { '00000000-0000-4000-8000-000000000012': 'OPEN' },
    fogLayers: [{ ownerUserId: null, chunks: [{ index: 0 }] }]
  })
  expect(result).not.toHaveProperty('recipientRevision')
})

it('returns a compact recipient snapshot without paged hydration', async () => {
  const { recipientRevision: _recipientRevision, snapshot: _snapshot, ...sceneHeader } = header
  const compactHeader = sceneRecipientHeaderSchema.parse({
    ...header,
    snapshot: {
      ...sceneHeader,
      annotations: [],
      barriers: [],
      darknessZones: [],
      lights: [],
      tokens: [],
      measurements: [],
      doorStates: {},
      fogLayers: []
    }
  })
  const convex = client()
  const action = vi.spyOn(convex, 'action')
  const query = vi.spyOn(convex, 'query')

  await expect(loadCampaignLiveScene(convex, compactHeader)).resolves.toEqual(
    compactHeader.snapshot
  )
  expect(action).not.toHaveBeenCalled()
  expect(query).not.toHaveBeenCalled()
})
it('rejects a final recipient revision change and nonadvancing recipient pages', async () => {
  const stale = { ...header, recipientRevision: 'b'.repeat(64) }
  const convex = client()
  setup(convex, stale)
  await expect(loadCampaignLiveScene(convex, header)).rejects.toThrow(
    'Scene recipient authority changed before hydration completed.'
  )

  const loop = client()
  setup(loop)
  vi.spyOn(loop, 'action').mockImplementation(async (...[, args]) => {
    const input = sceneRecipientPageInputSchema.parse(args)
    if (input.collection === 'annotations')
      return {
        version: header.version,
        recipientRevision: revision,
        collection: input.collection,
        page: [],
        next: input.afterEntityId ?? '00000000-0000-4000-8000-000000000021'
      }
    const row = entity(input.collection)
    return {
      version: header.version,
      recipientRevision: revision,
      collection: input.collection,
      page: [
        {
          value: row,
          doorState: input.collection === 'barriers' ? 'OPEN' : null
        }
      ],
      next: null
    }
  })
  await expect(loadCampaignLiveScene(loop, header)).rejects.toThrow(
    'Scene recipient entity pagination did not advance.'
  )
})

it('stops before querying when hydration is cancelled', async () => {
  const convex = client()
  const action = vi.spyOn(convex, 'action')
  const query = vi.spyOn(convex, 'query')
  const controller = new AbortController()
  controller.abort(new Error('cancelled'))
  await expect(loadCampaignLiveScene(convex, header, controller.signal)).rejects.toThrow(
    'cancelled'
  )
  expect(action).not.toHaveBeenCalled()
  expect(query).not.toHaveBeenCalled()
})

it('hydrates binding continuations and rejects stale, duplicate, and cycling binding pages', async () => {
  const binding = sceneEncounterBindingSchema.parse({
    encounterId,
    encounterVersion: 4,
    sceneId
  })
  const row = { actorId, encounterId, sceneId, tokenId }
  const finalQueries = (convex: ConvexReactClient, finalBinding = binding) =>
    vi.spyOn(convex, 'query').mockImplementation(async (...[reference, args]) => {
      const name = getFunctionName(reference)
      if (name === getFunctionName(api.encounters.sceneBindings.get)) return finalBinding
      if (name === getFunctionName(api.scenes.recipientReads.header)) {
        expect(args).toEqual({ sceneId, includeSnapshot: false })
        return header
      }
      throw new Error(`Unexpected query ${name}`)
    })

  const continued = client()
  finalQueries(continued)
  vi.spyOn(continued, 'action').mockImplementation(async (...[reference, args]) => {
    expect(getFunctionName(reference)).toBe(
      getFunctionName(api.scenes.recipientActions.encounterBindings)
    )
    const input = sceneRecipientEncounterBindingsInputSchema.parse(args)
    return input.afterEntityId === null
      ? {
          ...binding,
          version: header.version,
          recipientRevision: revision,
          page: [],
          next: tokenId
        }
      : {
          ...binding,
          version: header.version,
          recipientRevision: revision,
          page: [row],
          next: null
        }
  })
  await expect(loadCampaignSceneEncounterBindings(continued, binding, header)).resolves.toEqual([
    row
  ])

  const stale = client()
  finalQueries(stale, { ...binding, encounterVersion: 5 })
  vi.spyOn(stale, 'action').mockResolvedValue({
    ...binding,
    version: header.version,
    recipientRevision: revision,
    page: [],
    next: null
  })
  await expect(loadCampaignSceneEncounterBindings(stale, binding, header)).rejects.toThrow(
    'Encounter Scene binding authority changed before hydration completed.'
  )

  const duplicate = client()
  finalQueries(duplicate)
  vi.spyOn(duplicate, 'action').mockImplementation(async () => ({
    ...binding,
    version: header.version,
    recipientRevision: revision,
    page: [row],
    next: tokenId
  }))
  await expect(loadCampaignSceneEncounterBindings(duplicate, binding, header)).rejects.toThrow(
    'Encounter Scene binding page is inconsistent.'
  )

  const cycle = client()
  finalQueries(cycle)
  vi.spyOn(cycle, 'action').mockImplementation(async (...[, args]) => {
    const input = sceneRecipientEncounterBindingsInputSchema.parse(args)
    return {
      ...binding,
      version: header.version,
      recipientRevision: revision,
      page: [],
      next: input.afterEntityId ?? tokenId
    }
  })
  await expect(loadCampaignSceneEncounterBindings(cycle, binding, header)).rejects.toThrow(
    'Encounter Scene binding pagination did not advance.'
  )
})
