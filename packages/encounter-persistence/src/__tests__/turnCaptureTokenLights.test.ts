import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  srdCreatureActor,
  srdEncounterState,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { nightmare } from '@artificer-toolkit/source-data/srd/creatures/nightmare.js'
import { ogre } from '@artificer-toolkit/source-data/srd/creatures/ogre.js'

import { insertRunActor } from '../documents.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import { readEncounterTurnCapture } from '../turnCapture.js'

/**
 * SPELLS-33 T6j: the Scene perception capture carries the light each Creature bound to a token on
 * the Encounter's Scene sheds, so the Worker composes it onto those tokens for D108 illumination.
 */

const OCCURRED_AT = '2026-10-18T00:00:00.000Z'
const SCENE_ID = testUuid(0x5c0)
const OTHER_SCENE_ID = testUuid(0x5c1)
const NIGHTMARE_ID = testUuid(0xa01)
const OGRE_ID = testUuid(0xa02)
const STRAY_NIGHTMARE_ID = testUuid(0xa03)
const tokenOf = (actorId: string) => `${actorId.slice(0, -4)}7${actorId.slice(-3)}`

const header = sceneLiveStateHeaderSchema.parse({
  ambientIllumination: 'ORDINARY_DARKNESS',
  daylight: false,
  campaignId: CAMPAIGN_ID,
  counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 0 },
  currentCounts: {
    annotations: 0,
    barriers: 0,
    darknessZones: 0,
    lights: 0,
    measurements: 0,
    tokens: 3
  },
  definitionId: testUuid(0x5c2),
  definitionSaveId: testUuid(0x5c3),
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
  id: SCENE_ID,
  map: { assetId: testUuid(0x5c4), height: 100, tileManifestAssetId: null, width: 100 },
  name: 'Scene',
  version: 1,
  visionRevealMode: 'ON_DRAG'
})

describe('Scene perception capture (SPELLS-33.T6j)', () => {
  it('returns the light of each Creature bound on the Encounter’s Scene, and only those', async () => {
    const actors = [
      srdCreatureActor({ id: NIGHTMARE_ID, creature: nightmare }),
      srdCreatureActor({ id: OGRE_ID, creature: ogre }),
      srdCreatureActor({ id: STRAY_NIGHTMARE_ID, creature: nightmare })
    ]
    const state = encounterRunStateSchema.parse(srdEncounterState({ actors, currentActorId: null }))
    const memory = createMemoryEncounterStore()
    const ctx = { db: memory.store }
    for (const actor of actors) await insertRunActor(ctx, actor)
    await memory.store.insert('encounterSceneBindings', {
      encounterId: ENCOUNTER_ID,
      campaignId: CAMPAIGN_ID,
      sceneId: SCENE_ID,
      commandId: testUuid(0xc01),
      commandFingerprint: 'a'.repeat(64),
      createdAt: OCCURRED_AT
    })
    for (const [actorId, sceneId] of [
      [NIGHTMARE_ID, SCENE_ID],
      [OGRE_ID, SCENE_ID],
      [STRAY_NIGHTMARE_ID, OTHER_SCENE_ID]
    ] as const)
      await memory.store.insert('encounterActorTokenBindings', {
        actorId,
        encounterId: ENCOUNTER_ID,
        sceneId,
        tokenId: tokenOf(actorId)
      })

    const response = await readEncounterTurnCapture(
      ctx,
      state,
      { kind: 'SCENE_PERCEPTION', observerActorId: OGRE_ID, subjectActorId: NIGHTMARE_ID },
      {
        readSceneHeader: async () => header,
        readSceneEntities: async () => {
          throw new Error('The perception header capture reads no Scene entities.')
        }
      }
    )

    expect(response).toEqual({
      kind: 'SCENE_PERCEPTION',
      context: {
        header,
        observerTokenId: tokenOf(OGRE_ID),
        subjectTokenId: tokenOf(NIGHTMARE_ID),
        tokenLights: [
          {
            tokenId: tokenOf(NIGHTMARE_ID),
            light: { bright: { amount: 10, unit: 'FEET' }, dim: { amount: 20, unit: 'FEET' } }
          }
        ]
      }
    })
  })
})
