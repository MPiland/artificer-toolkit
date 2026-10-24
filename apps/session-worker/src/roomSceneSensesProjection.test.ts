import { campaignSceneStateDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { describe, expect, it } from 'vitest'

import { withCharacterControllers } from '@artificer-toolkit/shared/campaign/characterControl'
import {
  createNativeLiveSessionState,
  projectNativeLiveSessionState
} from './nativeLiveSessionState.js'

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const OWNER = uuid(1)
const PLAYER = uuid(2)
const OTHER_PLAYER = uuid(3)

const darkvision = {
  channel: 'VISUAL',
  illuminationAccess: 'ORDINARY_DARKNESS',
  label: 'Darkvision',
  range: { rangeKind: 'DISTANCE', amount: 60 },
  senseId: uuid(0x50)
} as const

function token(id: number, controlledByUserIds: string[]) {
  return {
    assetId: null,
    controlledByUserIds,
    height: 1,
    hidden: false,
    id: uuid(id),
    label: `Token ${id}`,
    locked: false,
    position: { x: id, y: 0 },
    rotationDegrees: 0,
    senses: [darkvision],
    vision: null,
    width: 1
  }
}

const sceneWith = (tokens: ReturnType<typeof token>[]) =>
  campaignSceneStateDtoSchema.parse({
    id: uuid(0x10),
    campaignId: uuid(0x11),
    definitionId: uuid(0x12),
    definitionVersion: 1,
    name: 'Room Scene',
    ambientIllumination: 'BRIGHT',
    daylight: false,
    fogMode: 'OFF',
    visionRevealMode: 'ON_DRAG',
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
    map: { assetId: uuid(0x13), width: 1000, height: 1000, tileManifestAssetId: null },
    version: 0,
    annotations: [],
    barriers: [],
    darknessZones: [],
    lights: [],
    tokens,
    measurements: [],
    fogLayers: [],
    doorStates: {}
  })

const scene = sceneWith([token(0x20, [PLAYER]), token(0x21, [OTHER_PLAYER])])

function sensesByToken(
  recipient: { role: 'OWNER' | 'PLAYER'; userId: string },
  boundTokenControl: ReadonlyMap<string, boolean>,
  projectedScene = scene
) {
  const projected = projectNativeLiveSessionState(
    createNativeLiveSessionState(projectedScene).state,
    recipient,
    null,
    boundTokenControl
  )
  return projected.scene?.tokens.map(({ id, senses }) => ({ id, senses }))
}

describe('Scene token senses in the recipient projection', () => {
  it('gives the GM every token sense', () => {
    expect(sensesByToken({ role: 'OWNER', userId: OWNER }, new Map())).toEqual([
      { id: uuid(0x20), senses: [darkvision] },
      { id: uuid(0x21), senses: [darkvision] }
    ])
  })

  it('gives a player the senses of the tokens they control and no others', () => {
    expect(sensesByToken({ role: 'PLAYER', userId: PLAYER }, new Map())).toEqual([
      { id: uuid(0x20), senses: [darkvision] },
      { id: uuid(0x21), senses: [] }
    ])
    expect(sensesByToken({ role: 'PLAYER', userId: OTHER_PLAYER }, new Map())).toEqual([
      { id: uuid(0x20), senses: [] },
      { id: uuid(0x21), senses: [darkvision] }
    ])
  })

  describe('on an Encounter-bound Scene', () => {
    // 0x30: bound, controlled through its actor though not in controlledByUserIds.
    // 0x31: bound, listed in controlledByUserIds but its actor is not the player's.
    // 0x32: bound to a Creature, controlled by nobody.
    // 0x33: bound to another player's Character.
    // 0x34: unbound, follows the Scene's controlledByUserIds.
    const boundScene = sceneWith([
      token(0x30, [OTHER_PLAYER]),
      token(0x31, [PLAYER]),
      token(0x32, []),
      token(0x33, [OTHER_PLAYER]),
      token(0x34, [PLAYER])
    ])
    const control = new Map([
      [uuid(0x30), true],
      [uuid(0x31), false],
      [uuid(0x32), false],
      [uuid(0x33), false]
    ])

    it('gives a player senses by bound actor control, not the Scene control list', () => {
      expect(sensesByToken({ role: 'PLAYER', userId: PLAYER }, control, boundScene)).toEqual([
        { id: uuid(0x30), senses: [darkvision] },
        { id: uuid(0x31), senses: [] },
        { id: uuid(0x32), senses: [] },
        { id: uuid(0x33), senses: [] },
        { id: uuid(0x34), senses: [darkvision] }
      ])
    })

    it('still gives the GM every sense', () => {
      expect(
        sensesByToken({ role: 'OWNER', userId: OWNER }, new Map(), boundScene)?.map(
          ({ senses }) => senses
        )
      ).toEqual(Array(5).fill([darkvision]))
    })
  })

  describe('for a Character the GM granted (D162)', () => {
    // 0x40 is linked to a Character assigned to OWNER and granted to PLAYER; 0x41 to another Character.
    const characterId = uuid(0x60)
    const linked = (id: number, linkedCharacterId: string) => ({
      ...token(id, []),
      characterId: linkedCharacterId
    })
    const grantScene = sceneWith([linked(0x40, characterId), linked(0x41, uuid(0x61))])
    const projectFor = (userId: string, controllerUserIds: string[]) =>
      sensesByToken(
        { role: 'PLAYER', userId },
        new Map(),
        withCharacterControllers(grantScene, [{ characterId, controllerUserIds, userId: OWNER }])
      )

    it('gives the grantee the senses of that Character token alone', () => {
      expect(projectFor(PLAYER, [PLAYER])).toEqual([
        { id: uuid(0x40), senses: [darkvision] },
        { id: uuid(0x41), senses: [] }
      ])
    })

    it('shows a stranger nothing of it, and a revoked grantee loses it', () => {
      expect(projectFor(OTHER_PLAYER, [PLAYER])?.map(({ senses }) => senses)).toEqual([[], []])
      expect(projectFor(PLAYER, [])?.map(({ senses }) => senses)).toEqual([[], []])
    })
  })
})
