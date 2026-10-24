import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  sceneEncounterBindingSchema,
  sceneRecipientHeaderSchema,
  sceneRecipientEncounterBindingsInputSchema
} from '@artificer-toolkit/schema/api/sceneRecipient'
import { loadCampaignSceneEncounterBindings } from './liveScenes'

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
  daylight: false,
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

afterEach(() => vi.restoreAllMocks())

it('hydrates binding continuations and rejects stale, duplicate, and cycling binding pages', async () => {
  const binding = sceneEncounterBindingSchema.parse({
    encounterId,
    encounterVersion: 4,
    sceneId
  })
  const row = { actorId, encounterId, sceneId, tokenId }
  const queries = (convex: ConvexReactClient, finalBinding = binding) =>
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
  queries(continued)
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
  await expect(loadCampaignSceneEncounterBindings(continued, binding)).resolves.toEqual([row])

  const stale = client()
  queries(stale, { ...binding, encounterVersion: 5 })
  vi.spyOn(stale, 'action').mockResolvedValue({
    ...binding,
    version: header.version,
    recipientRevision: revision,
    page: [],
    next: null
  })
  await expect(loadCampaignSceneEncounterBindings(stale, binding)).rejects.toThrow(
    'Encounter Scene binding authority changed before hydration completed.'
  )

  const duplicate = client()
  queries(duplicate)
  vi.spyOn(duplicate, 'action').mockImplementation(async () => ({
    ...binding,
    version: header.version,
    recipientRevision: revision,
    page: [row],
    next: tokenId
  }))
  await expect(loadCampaignSceneEncounterBindings(duplicate, binding)).rejects.toThrow(
    'Encounter Scene binding page is inconsistent.'
  )

  const cycle = client()
  queries(cycle)
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
  await expect(loadCampaignSceneEncounterBindings(cycle, binding)).rejects.toThrow(
    'Encounter Scene binding pagination did not advance.'
  )
})
