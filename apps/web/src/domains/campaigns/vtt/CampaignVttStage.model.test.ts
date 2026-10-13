import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { describe, expect, it } from 'vitest'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  assignedCharacterTokenId,
  canMoveSceneToken,
  createSceneBarrier,
  describeVttPing,
  nudgeSceneToken,
  readActiveTurn
} from './CampaignVttStage.model'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'

const currentUserId = '00000000-0000-4000-8000-000000000001'

function scene(): CampaignSceneStateDto {
  return {
    annotations: [],
    ambientIllumination: 'BRIGHT',
    barriers: [],
    campaignId: '00000000-0000-4000-8000-000000000002',
    darknessZones: [],
    definitionId: '00000000-0000-4000-8000-000000000003',
    definitionVersion: 1,
    doorStates: {},
    fogLayers: [],
    fogMode: 'SHARED_PARTY',
    visionRevealMode: 'ON_DROP',
    grid: {
      cellSize: 50,
      diagonalPolicy: 'ALTERNATING',
      distancePerCell: 5,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    },
    id: '00000000-0000-4000-8000-000000000005',
    lights: [],
    map: {
      assetId: '00000000-0000-4000-8000-000000000006',
      height: 400,
      tileManifestAssetId: null,
      width: 600
    },
    measurements: [],
    name: 'Accessible movement test',
    tokens: [
      {
        assetId: null,
        controlledByUserIds: [currentUserId],
        height: 50,
        hidden: false,
        id: '00000000-0000-4000-8000-000000000007',
        label: 'Ember',
        locked: false,
        position: { x: 75, y: 75 },
        rotationDegrees: 0,
        senses: [],
        vision: null,
        width: 50
      }
    ],
    version: 4
  }
}

describe('Campaign VTT accessible scene controls', () => {
  it('announces a received ping by its sender, and confirms a sent ping', () => {
    const { memberships } = createTabletopCampaign('OWNER')
    const otherUserId = '00000000-0000-4000-8000-000000000099'

    expect(describeVttPing(memberships, tabletopCurrentUserId, currentUserId)).toBe(
      'ember pinged the map.'
    )
    expect(describeVttPing(memberships, otherUserId, currentUserId)).toBe(
      'A table member pinged the map.'
    )
    expect(describeVttPing(memberships, currentUserId, currentUserId)).toBe('You pinged the map.')
  })

  it('creates each barrier with its renderer-neutral default behavior', () => {
    const a = { x: 10, y: 10 }
    const b = { x: 20, y: 20 }

    expect(createSceneBarrier('WINDOW', a, b)).toMatchObject({
      blocksLight: false,
      blocksMovement: true,
      kind: 'WINDOW'
    })
    expect(createSceneBarrier('ONE_WAY', a, b)).toMatchObject({
      blockedDirection: 'LEFT_TO_RIGHT',
      blocksLight: true,
      blocksMovement: true,
      kind: 'ONE_WAY'
    })
    expect(createSceneBarrier('TERRAIN', a, b)).toMatchObject({
      kind: 'TERRAIN',
      movementCostMultiplier: 2
    })
  })

  it('uses the same token-control rule for a player and the GM', () => {
    const token = scene().tokens[0]!

    const unbound = new Map<string, boolean>()
    const player = { boundTokenControl: unbound, currentUserId, role: 'PLAYER' as const }

    expect(canMoveSceneToken(token, player)).toBe(true)
    expect(canMoveSceneToken(token, { ...player, currentUserId: crypto.randomUUID() })).toBe(false)
    expect(
      canMoveSceneToken(token, { ...player, currentUserId: crypto.randomUUID(), role: 'OWNER' })
    ).toBe(true)
    expect(canMoveSceneToken({ ...token, locked: true }, { ...player, role: 'OWNER' })).toBe(false)
  })

  it('moves Encounter-bound tokens by actor control instead of Scene token controllers', () => {
    const token = scene().tokens[0]!
    const otherUserId = crypto.randomUUID()
    const player = { currentUserId: otherUserId, role: 'PLAYER' as const }

    // A bound token granted to the player through its actor is draggable.
    expect(
      canMoveSceneToken(token, { ...player, boundTokenControl: new Map([[token.id, true]]) })
    ).toBe(true)
    // Another player's bound Character stays refused even though the token lists this viewer.
    expect(
      canMoveSceneToken(token, {
        boundTokenControl: new Map([[token.id, false]]),
        currentUserId,
        role: 'PLAYER'
      })
    ).toBe(false)
    expect(
      canMoveSceneToken(
        { ...token, locked: true },
        { ...player, boundTokenControl: new Map([[token.id, true]]) }
      )
    ).toBe(false)
  })

  it('nudges one grid step and keeps the token inside the map', () => {
    const current = scene()
    const token = current.tokens[0]!

    expect(nudgeSceneToken(current, token, 'RIGHT')).toEqual({ x: 125, y: 75 })
    expect(nudgeSceneToken(current, { ...token, position: { x: 25, y: 25 } }, 'UP')).toEqual({
      x: 25,
      y: 25
    })
  })

  it('rejects a nudge through a wall or closed door and allows an open door', () => {
    const current = scene()
    const token = current.tokens[0]!
    const wall = {
      ...current,
      barriers: [
        {
          a: { x: 100, y: 0 },
          b: { x: 100, y: 400 },
          blocksLight: true,
          blocksMovement: true,
          id: 'wall',
          kind: 'WALL' as const
        }
      ]
    }
    expect(nudgeSceneToken(wall, token, 'RIGHT')).toEqual(token.position)

    const door = {
      ...current,
      barriers: [
        {
          a: { x: 100, y: 0 },
          b: { x: 100, y: 400 },
          blocksLightWhenClosed: true,
          blocksMovementWhenClosed: true,
          id: 'door',
          initialState: 'CLOSED' as const,
          kind: 'DOOR' as const,
          openAngleDegrees: 90
        }
      ]
    }
    expect(nudgeSceneToken(door, token, 'RIGHT')).toEqual(token.position)
    expect(nudgeSceneToken({ ...door, doorStates: { door: 'OPEN' } }, token, 'RIGHT')).toEqual({
      x: 125,
      y: 75
    })
  })
})

const walkSpeedId = 'walk-speed'

describe('Campaign VTT active turn movement readout (V07.5)', () => {
  const [character, creature] = tabletopPlayerEncounter.actors
  const movement = [
    {
      actorId: character.id,
      used: 15,
      speedId: null,
      allowances: [{ speedId: walkSpeedId, code: 'WALK', label: 'Walking Speed', budget: 30 }]
    },
    {
      actorId: creature.id,
      used: 5,
      speedId: walkSpeedId,
      allowances: [{ speedId: walkSpeedId, code: 'WALK', label: 'Walking Speed', budget: 40 }]
    }
  ] satisfies EncounterSessionStateDto['turnMovement']
  function state(
    encounter: EncounterSessionStateDto['encounter'],
    turnMovement: EncounterSessionStateDto['turnMovement'] = movement
  ): EncounterSessionStateDto {
    return { encounter, pending: null, waitingOn: null, turnMovement }
  }

  it("shows a player the readout on their own Character's turn only", () => {
    const player = createTabletopCampaign('PLAYER')
    expect(
      readActiveTurn(player, tabletopCurrentUserId, state(tabletopPlayerEncounter))
    ).toMatchObject({
      currentActorMine: true,
      turnMovement: movement[0]
    })
    const creatureTurn = { ...tabletopPlayerEncounter, currentActorId: creature.id }
    expect(readActiveTurn(player, tabletopCurrentUserId, state(creatureTurn))).toMatchObject({
      currentActor: { id: creature.id },
      currentActorMine: false,
      turnMovement: undefined
    })
  })

  it("shows the GM the current actor's readout on every turn", () => {
    const gm = createTabletopCampaign('OWNER')
    const creatureTurn = { ...tabletopGmEncounter, currentActorId: creature.id }
    expect(readActiveTurn(gm, tabletopCurrentUserId, state(creatureTurn))).toMatchObject({
      currentActorMine: true,
      turnMovement: movement[1]
    })
  })

  it('shows no readout outside an active Encounter or before its movement loads', () => {
    const player = createTabletopCampaign('PLAYER')
    const completed = { ...tabletopPlayerEncounter, status: 'COMPLETED' as const }
    expect(readActiveTurn(player, tabletopCurrentUserId, state(completed))).toEqual({
      encounter: undefined,
      currentActor: undefined,
      currentActorMine: false,
      turnMovement: undefined
    })
    expect(readActiveTurn(player, tabletopCurrentUserId, undefined).turnMovement).toBeUndefined()
    expect(
      readActiveTurn(player, tabletopCurrentUserId, state(tabletopPlayerEncounter, [])).turnMovement
    ).toBeUndefined()
  })
})

describe('Campaign VTT assigned Character token (VTT_UI-3.4)', () => {
  const actors = [
    { id: 'actor-npc', kind: 'CREATURE', sourceId: 'char-1' },
    { id: 'actor-hero', kind: 'CHARACTER', sourceId: 'char-1' },
    { id: 'actor-other', kind: 'CHARACTER', sourceId: 'char-2' }
  ] as const
  const actorIdByTokenId = new Map([
    ['token-npc', 'actor-npc'],
    ['token-hero', 'actor-hero'],
    ['token-other', 'actor-other']
  ])

  it('finds the token bound to the assigned Character actor', () => {
    expect(
      assignedCharacterTokenId({ actorIdByTokenId, actors, assignedCharacterId: 'char-1' })
    ).toBe('token-hero')
  })

  it('finds nothing without an assigned Character or a bound token', () => {
    expect(
      assignedCharacterTokenId({ actorIdByTokenId, actors, assignedCharacterId: null })
    ).toBeNull()
    expect(
      assignedCharacterTokenId({
        actorIdByTokenId: new Map(),
        actors,
        assignedCharacterId: 'char-1'
      })
    ).toBeNull()
  })
})
