import {
  campaignSceneStateDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { describe, expect, it } from 'vitest'
import {
  encounterSessionStateDtoSchema,
  type EncounterSessionStateDto
} from '@artificer-toolkit/schema/api/encounterData'
import {
  assignedCharacterTokenId,
  canMoveSceneToken,
  characterControlAssignments,
  controlledCharacters,
  createSceneBarrier,
  describeVttPing,
  nudgeSceneToken,
  readActiveTurn,
  resolveMainCharacterId
} from './CampaignVttStage.model'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'
import { validated } from '../../../test/validatedFixture'

const currentUserId = '00000000-0000-4000-8000-000000000001'

function scene(): CampaignSceneStateDto {
  return validated(campaignSceneStateDtoSchema)({
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
  })
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
  const movement = validated(encounterSessionStateDtoSchema.shape.turnMovement)([
    {
      actorId: character.id,
      used: 15,
      speedId: null,
      allowances: [
        { speedId: walkSpeedId, code: 'WALK', isDefault: true, label: 'Walking Speed', budget: 30 }
      ],
      teleport: [],
      fleeSourceActorIds: []
    },
    {
      actorId: creature.id,
      used: 5,
      speedId: walkSpeedId,
      allowances: [
        { speedId: walkSpeedId, code: 'WALK', isDefault: true, label: 'Walking Speed', budget: 40 }
      ],
      teleport: [],
      fleeSourceActorIds: []
    }
  ])
  function state(
    encounter: EncounterSessionStateDto['encounter'],
    turnMovement: EncounterSessionStateDto['turnMovement'] = movement
  ): EncounterSessionStateDto {
    return validated(encounterSessionStateDtoSchema)({
      encounter,
      pending: null,
      waitingOn: null,
      turnMovement,
      halfSpeedFields: [],
      auras: [],
      movementCostZones: []
    })
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
      assignedCharacterTokenId({
        actorIdByTokenId,
        actors,
        assignedCharacterId: 'char-1',
        tokens: []
      })
    ).toBe('token-hero')
  })

  it('finds nothing without an assigned Character or a bound token', () => {
    expect(
      assignedCharacterTokenId({
        actorIdByTokenId,
        actors,
        assignedCharacterId: null,
        tokens: [{ characterId: 'char-1', id: 'token-linked' }]
      })
    ).toBeNull()
    expect(
      assignedCharacterTokenId({
        actorIdByTokenId: new Map(),
        actors,
        assignedCharacterId: 'char-1',
        tokens: []
      })
    ).toBeNull()
  })

  it('falls back to the unbound token linked to the Character (D162)', () => {
    const tokens = [
      { characterId: 'char-2', id: 'token-linked-other' },
      { characterId: 'char-1', id: 'token-linked' }
    ]
    expect(
      assignedCharacterTokenId({
        actorIdByTokenId: new Map(),
        actors: [],
        assignedCharacterId: 'char-1',
        tokens
      })
    ).toBe('token-linked')
    // The bound token wins when the Character is in the Encounter.
    expect(
      assignedCharacterTokenId({ actorIdByTokenId, actors, assignedCharacterId: 'char-1', tokens })
    ).toBe('token-hero')
  })
})

describe('Campaign VTT main Character (SCENE-5.2)', () => {
  const own = tabletopCurrentUserId
  const gm = '00000000-0000-4000-8000-0000000000aa'
  const granted = '00000000-0000-4000-8000-0000000000bb'
  const character = (id: string, label: string) => ({
    id,
    label,
    publicId: label.toLowerCase(),
    systemId: '00000000-0000-4000-8000-0000000000cc'
  })
  const base = createTabletopCampaign('PLAYER').memberships[0]!
  const member = (
    userId: string,
    assigned: ReturnType<typeof character> | null,
    characterControllerUserIds: string[] = []
  ) => ({
    ...base,
    assignedCharacter: assigned,
    characterControllerUserIds,
    userId
  })
  const mine = character('char-mine', 'Mine')
  const memberships = [
    member(granted, character('char-granted', 'Granted'), [own]),
    member(gm, character('char-ungranted', 'Ungranted'), [granted]),
    member('00000000-0000-4000-8000-0000000000dd', null),
    member(own, mine)
  ]

  it('lists only the Characters the member controls, their own first', () => {
    expect(controlledCharacters(memberships, own).map(({ id }) => id)).toEqual([
      'char-mine',
      'char-granted'
    ])
    expect(controlledCharacters(memberships, granted).map(({ id }) => id)).toEqual([
      'char-granted',
      'char-ungranted'
    ])
    expect(controlledCharacters(memberships, '00000000-0000-4000-8000-0000000000ee')).toEqual([])
  })

  it('defaults to the first controlled Character and drops a pick that is no longer controlled', () => {
    const controlled = controlledCharacters(memberships, own)
    expect(resolveMainCharacterId(controlled, null)).toBe('char-mine')
    expect(resolveMainCharacterId(controlled, 'char-granted')).toBe('char-granted')
    expect(resolveMainCharacterId(controlled, 'char-ungranted')).toBe('char-mine')
    expect(resolveMainCharacterId([], 'char-granted')).toBeNull()
  })

  it('reads every assignment with its grants for the shared control helper', () => {
    expect(characterControlAssignments(memberships)).toEqual([
      { characterId: 'char-granted', controllerUserIds: [own], userId: granted },
      { characterId: 'char-ungranted', controllerUserIds: [granted], userId: gm },
      { characterId: 'char-mine', controllerUserIds: [], userId: own }
    ])
  })
})
