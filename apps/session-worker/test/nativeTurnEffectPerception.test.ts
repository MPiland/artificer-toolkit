import {
  liveSessionEncounterRulesResponseSchema,
  type LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { sceneCurrentEntityPageSchema } from '@artificer-toolkit/schema/api/sceneRecipient'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import { expect, it } from 'vitest'

import { readNativeLivePerceptionScene } from '../src/nativeTurnEffectPerception.js'

const campaignId = '00000000-0000-4000-8000-000000000101'
const sceneId = '00000000-0000-4000-8000-000000000102'
const saveId = '00000000-0000-4000-8000-000000000103'
const observerId = '00000000-0000-4000-8000-000000000104'
const subjectId = '00000000-0000-4000-8000-000000000105'
const systemId = '00000000-0000-4000-8000-000000000106'
const checksum = '0'.repeat(64)
const revisions = [
  { scope: 'SYSTEM' as const, id: systemId, revision: null },
  { scope: 'CAMPAIGN' as const, id: campaignId, revision: null },
  { scope: 'PLAY' as const, id: campaignId, revision: null }
]

function token(ordinal: number) {
  return {
    assetId: null,
    controlledByUserIds: [],
    height: 5,
    hidden: false,
    id: `00000000-0000-4000-8000-${String(ordinal + 200).padStart(12, '0')}`,
    label: `Token ${ordinal}`,
    locked: false,
    position: { x: ordinal, y: 0 },
    rotationDegrees: 0,
    vision: null,
    width: 5
  }
}

const tokens = Array.from({ length: 10 }, (_, ordinal) => token(ordinal))
const header = sceneLiveStateHeaderSchema.parse({
  ambientIllumination: 'DIM',
  campaignId,
  counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 0 },
  currentCounts: {
    annotations: 0,
    barriers: 0,
    darknessZones: 0,
    lights: 0,
    measurements: 0,
    tokens: tokens.length
  },
  definitionId: '00000000-0000-4000-8000-000000000107',
  definitionSaveId: saveId,
  definitionVersion: 1,
  fogLayerCount: 0,
  fogMode: 'PER_PLAYER',
  grid: {
    cellSize: 50,
    diagonalPolicy: 'EQUAL',
    distancePerCell: 5,
    kind: 'SQUARE',
    origin: { x: 0, y: 0 },
    unit: 'FEET'
  },
  id: sceneId,
  map: {
    assetId: '00000000-0000-4000-8000-000000000108',
    height: 100,
    tileManifestAssetId: null,
    width: 100
  },
  name: 'Scene',
  version: 1,
  visionRevealMode: 'ON_DRAG'
})

it('reads BASE then multiple APPENDED pages and returns the complete Scene fence', async () => {
  const requests: LiveSessionEncounterRulesRequest[] = []
  const loaded = await readNativeLivePerceptionScene({
    campaignId,
    observerActorId: observerId,
    subjectActorId: subjectId,
    capture: async (request) => {
      requests.push(request)
      if (request.kind === 'SCENE_PERCEPTION')
        return liveSessionEncounterRulesResponseSchema.parse({
          kind: request.kind,
          readChecksum: checksum,
          revisions,
          context: {
            header,
            observerTokenId: tokens[0]!.id,
            subjectTokenId: tokens[1]!.id
          }
        })
      if (request.kind !== 'SCENE_PERCEPTION_ENTITIES')
        throw new Error('Unexpected perception capture.')
      const { collection, phase, afterOrdinal } = request.page
      const isTokens = collection === 'tokens'
      const selected =
        !isTokens || phase === 'BASE'
          ? []
          : afterOrdinal === null
            ? tokens.slice(0, 8)
            : tokens.slice(8)
      const next =
        phase === 'BASE'
          ? { phase: 'APPENDED' as const, afterOrdinal: null }
          : isTokens && afterOrdinal === null
            ? { phase: 'APPENDED' as const, afterOrdinal: 7 }
            : null
      return liveSessionEncounterRulesResponseSchema.parse({
        kind: request.kind,
        readChecksum: checksum,
        revisions,
        page: sceneCurrentEntityPageSchema.parse({
          collection,
          version: header.version,
          next,
          page: selected.map((entity, ordinal) => ({
            ordinal: (afterOrdinal ?? -1) + ordinal + 1,
            doorState: null,
            value: { collection: 'tokens', entity }
          }))
        })
      })
    }
  })

  expect(
    requests.flatMap((request) =>
      request.kind === 'SCENE_PERCEPTION_ENTITIES' && request.page.collection === 'tokens'
        ? [request.page.phase]
        : []
    )
  ).toEqual(['BASE', 'APPENDED', 'APPENDED'])
  expect(loaded).toMatchObject({
    id: sceneId,
    version: header.version,
    definitionSaveId: saveId,
    scene: { tokens }
  })
})
