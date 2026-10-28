import { describe, expect, it } from 'vitest'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import type { HealthDisplayLevelDto } from '@artificer-toolkit/schema/api/healthDisplay'

import {
  healthDescriptiveState,
  unseenConditionTypeIds,
  playerActorHealth,
  projectPlayerEncounterProjection,
  unseenEncounterActorIds
} from '../encounterPlayerProjection.js'

const ENCOUNTER_ID = '00000000-0000-4000-8000-000000000001'
const CAMPAIGN_ID = '00000000-0000-4000-8000-000000000002'
const PUBLIC_ACTOR_ID = '00000000-0000-4000-8000-000000000003'
const HIDDEN_ACTOR_ID = '00000000-0000-4000-8000-000000000004'
const PLAYER_ID = '00000000-0000-4000-8000-000000000005'
const OTHER_PLAYER_ID = '00000000-0000-4000-8000-000000000006'
const CHARACTER_ACTOR_ID = '00000000-0000-4000-8000-000000000007'
const CHARACTER_ID = '00000000-0000-4000-8000-000000000008'

function gmActor(id: string, visible: boolean) {
  return {
    id,
    encounterId: ENCOUNTER_ID,
    kind: 'CREATURE' as const,
    label: visible ? 'Goblin scout' : 'Hidden archer',
    sourceId: null,
    sourceRevision: null,
    public: visible,
    controllerUserIds: visible ? [PLAYER_ID] : [],
    disposition: visible ? ('NEUTRAL' as const) : ('HOSTILE' as const),
    initiative: 12,
    manualOrder: null,
    conditions: [],
    healthBand: 'BLOODIED' as const,
    healthDisplay: null as HealthDisplayLevelDto | null,
    systemId: null,
    stableTieKey: id,
    currentHitPoints: 3,
    maxHitPoints: 7,
    tempHitPoints: 0,
    defeated: false,
    absence: null,
    resources: {},
    gmNotes: 'GM only',
    statBlock: null,
    features: []
  }
}

function gmEncounter(actors: unknown[], healthDisplayDefault: HealthDisplayLevelDto = 'HIDDEN') {
  return encounterGmProjectionDtoSchema.parse({
    id: ENCOUNTER_ID,
    campaignId: CAMPAIGN_ID,
    gameSystemId: ENCOUNTER_ID,
    blueprintId: CAMPAIGN_ID,
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    name: 'Goblin ambush',
    status: 'ACTIVE',
    automationMode: 'ASSISTED',
    healthDisplayDefault,
    version: 4,
    round: 1,
    currentActorId: null,
    actors,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z'
  })
}

const noCharacters = {
  userId: OTHER_PLAYER_ID,
  characters: new Map(),
  unseenActorIds: new Set<string>(),
  unseenConditionTypeIds: new Set<string>()
}

describe('player encounter projection', () => {
  it('omits every actor health band and hidden actors while keeping control and disposition', () => {
    const gm = encounterGmProjectionDtoSchema.parse({
      id: ENCOUNTER_ID,
      campaignId: CAMPAIGN_ID,
      gameSystemId: ENCOUNTER_ID,
      blueprintId: CAMPAIGN_ID,
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      name: 'Goblin ambush',
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      healthDisplayDefault: 'HIDDEN',
      version: 4,
      round: 1,
      currentActorId: HIDDEN_ACTOR_ID,
      actors: [gmActor(PUBLIC_ACTOR_ID, true), gmActor(HIDDEN_ACTOR_ID, false)],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })

    const player = projectPlayerEncounterProjection(gm, noCharacters)

    expect(player.currentActorId).toBeNull()
    expect(player.actors.map((actor) => actor.id)).toEqual([PUBLIC_ACTOR_ID])
    expect(player.actors[0]).toMatchObject({
      controllerUserIds: [PLAYER_ID],
      disposition: 'NEUTRAL'
    })
    for (const field of ['healthBand', 'currentHitPoints', 'gmNotes', 'resources'])
      expect(player.actors[0]).not.toHaveProperty(field)
    expect(player.actors[0]?.health).toBeNull()
  })

  it('lists an owned actor for the player who controls its owner, and for nobody else', () => {
    const owner = { ...gmActor(PUBLIC_ACTOR_ID, true), controllerUserIds: [PLAYER_ID] }
    const summon = {
      ...gmActor(HIDDEN_ACTOR_ID, true),
      controllerUserIds: [],
      owner: { ownerActorId: PUBLIC_ACTOR_ID }
    }
    const gm = gmEncounter([owner, summon])
    const viewer = (userId: string) => ({
      userId,
      characters: new Map(),
      unseenActorIds: new Set([HIDDEN_ACTOR_ID]),
      unseenConditionTypeIds: new Set<string>()
    })

    expect(
      projectPlayerEncounterProjection(gm, viewer(PLAYER_ID)).actors.map((actor) => actor.id)
    ).toEqual([PUBLIC_ACTOR_ID, HIDDEN_ACTOR_ID])
    expect(
      projectPlayerEncounterProjection(gm, viewer(OTHER_PLAYER_ID)).actors.map((actor) => actor.id)
    ).toEqual([PUBLIC_ACTOR_ID])
  })

  it('carries only what each health display level allows', () => {
    expect(playerActorHealth('HIDDEN', 3, 7)).toBeNull()
    expect(playerActorHealth('DESCRIPTIVE', 3, 7)).toEqual({
      level: 'DESCRIPTIVE',
      state: 'BLOODIED'
    })
    // 3 of 7 is 42.9%, shown only at the nearest 5%.
    expect(playerActorHealth('BAR', 3, 7)).toEqual({ level: 'BAR', ratio: 0.45 })
    expect(playerActorHealth('BAR', 0, 7)).toEqual({ level: 'BAR', ratio: 0 })
    expect(playerActorHealth('EXACT', 3, 7)).toEqual({ level: 'EXACT', current: 3, maximum: 7 })
    expect([8, 7, 5, 4, 2, 1, 0].map((current) => healthDescriptiveState(current, 8))).toEqual([
      'UNHURT',
      'HURT',
      'HURT',
      'BLOODIED',
      'NEAR_DEATH',
      'NEAR_DEATH',
      'NEAR_DEATH'
    ])
  })

  it('prefers the actor override to the Encounter default, and shows controllers exact health', () => {
    const overridden = {
      ...gmActor(HIDDEN_ACTOR_ID, true),
      controllerUserIds: [],
      healthDisplay: 'BAR' as const
    }
    const gm = gmEncounter([gmActor(PUBLIC_ACTOR_ID, true), overridden], 'DESCRIPTIVE')
    const other = projectPlayerEncounterProjection(gm, noCharacters)
    expect(other.actors.map((actor) => actor.health)).toEqual([
      { level: 'DESCRIPTIVE', state: 'BLOODIED' },
      { level: 'BAR', ratio: 0.45 }
    ])
    const controller = projectPlayerEncounterProjection(gm, {
      ...noCharacters,
      userId: PLAYER_ID
    })
    expect(controller.actors[0]?.health).toEqual({ level: 'EXACT', current: 3, maximum: 7 })
  })

  it("shows a Character at its player's level, never the Encounter default", () => {
    const character = {
      ...gmActor(CHARACTER_ACTOR_ID, true),
      kind: 'CHARACTER' as const,
      sourceId: CHARACTER_ID,
      controllerUserIds: []
    }
    const gm = gmEncounter([character], 'EXACT')
    const characters = new Map([
      [CHARACTER_ID, { ownerUserId: PLAYER_ID, health: 'DESCRIPTIVE' as const }]
    ])
    expect(
      projectPlayerEncounterProjection(gm, { ...noCharacters, userId: OTHER_PLAYER_ID, characters })
        .actors[0]?.health
    ).toEqual({ level: 'DESCRIPTIVE', state: 'BLOODIED' })
    expect(
      projectPlayerEncounterProjection(gm, { ...noCharacters, userId: PLAYER_ID, characters })
        .actors[0]?.health
    ).toEqual({ level: 'EXACT', current: 3, maximum: 7 })
    expect(projectPlayerEncounterProjection(gm, noCharacters).actors[0]?.health).toBeNull()
  })

  it('lists active grants to a player but never the label of a hidden source', () => {
    const grants = [
      {
        effectId: '00000000-0000-4000-8000-0000000000a1',
        label: 'Aid',
        sourceHidden: false,
        sourceActorId: null,
        remainingTicks: 5,
        expiresAtCampaignMinute: null,
        polarity: 'BENEFICIAL' as const
      },
      {
        effectId: '00000000-0000-4000-8000-0000000000a2',
        label: 'Hidden trap blessing',
        sourceHidden: true,
        sourceActorId: PUBLIC_ACTOR_ID,
        remainingTicks: null,
        expiresAtCampaignMinute: 2001,
        polarity: 'NEUTRAL' as const
      }
    ]
    const gm = gmEncounter([{ ...gmActor(PUBLIC_ACTOR_ID, true), activeGrants: grants }])

    expect(gm.actors[0]?.activeGrants).toEqual(grants)
    expect(projectPlayerEncounterProjection(gm, noCharacters).actors[0]?.activeGrants).toEqual([
      grants[0],
      { ...grants[1], label: null, sourceActorId: null }
    ])
  })

  it('shows a Concentration to its controllers and the GM only, hiding a hidden source label (SPELLS-5.11)', () => {
    const concentration = { label: 'Hidden trap blessing', sourceHidden: true }
    const gm = gmEncounter([{ ...gmActor(PUBLIC_ACTOR_ID, true), concentration }])

    expect(gm.actors[0]?.concentration).toEqual(concentration)
    expect(
      projectPlayerEncounterProjection(gm, { ...noCharacters, userId: PLAYER_ID }).actors[0]
        ?.concentration
    ).toEqual({ label: null, sourceHidden: true })
    expect(projectPlayerEncounterProjection(gm, noCharacters).actors[0]?.concentration).toBeNull()
  })

  describe('creatures the viewer cannot see (ATTACK-17.3)', () => {
    const SEEN_ACTOR_ID = '00000000-0000-4000-8000-0000000000b1'
    const UNSEEN_ACTOR_ID = '00000000-0000-4000-8000-0000000000b2'
    const PRONE_TYPE_ID = '00000000-0000-4000-8000-0000000000d2'
    const unseenActor = {
      ...gmActor(UNSEEN_ACTOR_ID, true),
      label: 'Cave troll',
      controllerUserIds: [],
      conditions: [{ conditionTypeId: PRONE_TYPE_ID }],
      healthDisplay: 'EXACT' as const,
      activeGrants: [
        {
          effectId: '00000000-0000-4000-8000-0000000000c1',
          label: 'Aid',
          sourceHidden: false,
          sourceActorId: null,
          remainingTicks: 5,
          expiresAtCampaignMinute: null,
          polarity: 'BENEFICIAL' as const
        }
      ]
    }
    const seenActor = { ...gmActor(SEEN_ACTOR_ID, true), controllerUserIds: [] }
    const viewerWith = (unseen: string[], userId = OTHER_PLAYER_ID) => ({
      userId,
      characters: new Map(),
      unseenActorIds: new Set(unseen),
      unseenConditionTypeIds: new Set<string>()
    })

    it('omits a public actor the viewer cannot see, and keeps it for the GM', () => {
      const gm = gmEncounter([seenActor, unseenActor])

      expect(gm.actors.map((actor) => actor.id)).toEqual([SEEN_ACTOR_ID, UNSEEN_ACTOR_ID])
      expect(
        projectPlayerEncounterProjection(gm, viewerWith([UNSEEN_ACTOR_ID])).actors.map(
          (actor) => actor.id
        )
      ).toEqual([SEEN_ACTOR_ID])
    })

    it('keeps an unseen actor the viewer controls', () => {
      const gm = gmEncounter([{ ...unseenActor, controllerUserIds: [PLAYER_ID] }])

      expect(
        projectPlayerEncounterProjection(gm, viewerWith([UNSEEN_ACTOR_ID], PLAYER_ID)).actors
      ).toMatchObject([{ id: UNSEEN_ACTOR_ID, label: 'Cave troll' }])
    })

    it("keeps an unseen Character actor its player's own", () => {
      const character = {
        ...unseenActor,
        kind: 'CHARACTER' as const,
        sourceId: CHARACTER_ID,
        label: 'Aria'
      }
      const characters = new Map([
        [CHARACTER_ID, { ownerUserId: PLAYER_ID, health: 'HIDDEN' as const }]
      ])

      expect(
        projectPlayerEncounterProjection(gmEncounter([character]), {
          userId: PLAYER_ID,
          characters,
          unseenActorIds: new Set([UNSEEN_ACTOR_ID]),
          unseenConditionTypeIds: new Set<string>()
        }).actors
      ).toMatchObject([{ id: UNSEEN_ACTOR_ID, label: 'Aria' }])
    })

    it('lists a creature revealed unnamed as an Unseen creature with nothing identifying', () => {
      const gm = gmEncounter([{ ...unseenActor, reveal: 'UNNAMED' }])
      const [listed] = projectPlayerEncounterProjection(gm, viewerWith([UNSEEN_ACTOR_ID])).actors

      expect(listed).toMatchObject({
        id: UNSEEN_ACTOR_ID,
        label: 'Unseen creature',
        sourceId: null,
        conditions: [],
        activeGrants: [],
        concentration: null,
        health: null,
        defeated: false,
        absence: null,
        initiative: 12
      })
      expect(JSON.stringify(listed)).not.toContain('Cave troll')
      expect(JSON.stringify(listed)).not.toContain(PRONE_TYPE_ID)
    })

    it('lists a creature revealed by name with its name', () => {
      const gm = gmEncounter([{ ...unseenActor, reveal: 'NAMED' }])
      const [listed] = projectPlayerEncounterProjection(gm, viewerWith([UNSEEN_ACTOR_ID])).actors

      expect(listed).toMatchObject({ id: UNSEEN_ACTOR_ID, label: 'Cave troll' })
    })

    // D131: a revealed creature the player cannot see says why, so the target list can mark it.
    describe('why a listed creature is unseen (D131)', () => {
      const INVISIBLE_TYPE_ID = '00000000-0000-4000-8000-0000000000d1'
      const invisibleViewer = (unseen: string[], userId = OTHER_PLAYER_ID) => ({
        ...viewerWith(unseen, userId),
        unseenConditionTypeIds: new Set([INVISIBLE_TYPE_ID])
      })
      const invisible = { conditionTypeId: INVISIBLE_TYPE_ID }

      it.each([
        {
          name: 'a seen actor',
          actor: seenActor,
          unseen: [] as string[],
          reveal: null,
          expected: null
        },
        {
          name: 'an unseen actor the viewer controls',
          actor: { ...unseenActor, controllerUserIds: [PLAYER_ID] },
          unseen: [UNSEEN_ACTOR_ID],
          reveal: null,
          expected: null
        },
        {
          name: 'a revealed creature the map hides',
          actor: unseenActor,
          unseen: [UNSEEN_ACTOR_ID],
          reveal: 'NAMED' as const,
          expected: 'HIDDEN'
        },
        {
          name: 'a revealed creature carrying other conditions',
          actor: { ...unseenActor, conditions: [{ conditionTypeId: PRONE_TYPE_ID }] },
          unseen: [UNSEEN_ACTOR_ID],
          reveal: 'UNNAMED' as const,
          expected: 'HIDDEN'
        },
        {
          name: 'a revealed creature carrying the Invisible condition',
          actor: { ...unseenActor, conditions: [invisible] },
          unseen: [UNSEEN_ACTOR_ID],
          reveal: 'NAMED' as const,
          expected: 'INVISIBLE'
        },
        {
          name: 'an Invisible creature revealed unnamed',
          actor: { ...unseenActor, conditions: [invisible] },
          unseen: [UNSEEN_ACTOR_ID],
          reveal: 'UNNAMED' as const,
          expected: 'INVISIBLE'
        },
        {
          name: 'an Invisible creature the map draws',
          actor: { ...seenActor, conditions: [invisible] },
          unseen: [] as string[],
          reveal: null,
          expected: null
        }
      ])('marks $name as $expected', ({ actor, unseen, reveal, expected }) => {
        const gm = gmEncounter([{ ...actor, ...(reveal ? { reveal } : {}) }])
        const viewer = invisibleViewer(unseen, actor.controllerUserIds[0] ?? OTHER_PLAYER_ID)

        expect(projectPlayerEncounterProjection(gm, viewer).actors[0]?.unseenReason).toBe(expected)
      })

      it('exposes only the Invisible fact of an unnamed reveal, never another condition', () => {
        const gm = gmEncounter([
          {
            ...unseenActor,
            reveal: 'UNNAMED',
            conditions: [invisible, { conditionTypeId: PRONE_TYPE_ID }]
          }
        ])
        const [listed] = projectPlayerEncounterProjection(
          gm,
          invisibleViewer([UNSEEN_ACTOR_ID])
        ).actors

        expect(listed).toMatchObject({ conditions: [], unseenReason: 'INVISIBLE' })
        expect(JSON.stringify(listed)).not.toContain(PRONE_TYPE_ID)
      })

      it('finds the unseen condition types of a System by their attribute, not their code', () => {
        expect(
          unseenConditionTypeIds([
            { id: 'a', code: 'BLINDED' },
            { id: INVISIBLE_TYPE_ID, code: 'INVISIBLE' },
            { id: 'b', code: 'CLOAKED', unseen: true }
          ])
        ).toEqual(new Set(['b']))
      })
    })

    it('shows no turn for an unlisted actor, and the turn of one revealed unnamed', () => {
      const asCurrent = (actor: typeof unseenActor & { reveal?: 'UNNAMED' | 'NAMED' }) =>
        encounterGmProjectionDtoSchema.parse({
          ...gmEncounter([actor]),
          currentActorId: UNSEEN_ACTOR_ID
        })

      expect(
        projectPlayerEncounterProjection(asCurrent(unseenActor), viewerWith([UNSEEN_ACTOR_ID]))
          .currentActorId
      ).toBeNull()
      expect(
        projectPlayerEncounterProjection(
          asCurrent({ ...unseenActor, reveal: 'UNNAMED' }),
          viewerWith([UNSEEN_ACTOR_ID])
        ).currentActorId
      ).toBe(UNSEEN_ACTOR_ID)
    })

    it('never lists a non-public actor, even one marked revealed', () => {
      const gm = gmEncounter([{ ...unseenActor, public: false, reveal: 'NAMED' }])

      expect(projectPlayerEncounterProjection(gm, viewerWith([UNSEEN_ACTOR_ID])).actors).toEqual([])
    })

    it('carries no reveal or concealment field to a player (D116)', () => {
      const gm = gmEncounter([{ ...unseenActor, reveal: 'NAMED' }])
      const [listed] = projectPlayerEncounterProjection(gm, viewerWith([UNSEEN_ACTOR_ID])).actors

      for (const field of ['reveal', 'concealment', 'observers'])
        expect(listed).not.toHaveProperty(field)
    })
  })
})

describe('unseenEncounterActorIds (D121)', () => {
  const SCENE_ID = '00000000-0000-4000-8000-0000000000e1'
  const OTHER_SCENE_ID = '00000000-0000-4000-8000-0000000000e2'
  const TOKEN_ID = '00000000-0000-4000-8000-0000000000f1'
  const creature = { id: '00000000-0000-4000-8000-0000000000a1', kind: 'CREATURE' as const }
  const character = { id: '00000000-0000-4000-8000-0000000000a2', kind: 'CHARACTER' as const }
  const bound = (actor: { id: string }, sceneId = SCENE_ID) => [
    { actorId: actor.id, sceneId, tokenId: TOKEN_ID }
  ]

  // Every host's rows: the Convex reads cannot tell fog (`null`); the room passes the drawn tokens.
  const cases = [
    {
      name: 'an Encounter with no Scene lists everything',
      actor: creature,
      sceneId: null,
      bindings: [],
      convex: false,
      room: false
    },
    {
      name: 'a creature with no token on the Scene is staged off-map',
      actor: creature,
      sceneId: SCENE_ID,
      bindings: [],
      convex: true,
      room: true
    },
    {
      name: 'a party Character with no token stays listed',
      actor: character,
      sceneId: SCENE_ID,
      bindings: [],
      convex: false,
      room: false
    },
    {
      name: 'a creature whose only token is on another Scene has none here',
      actor: creature,
      sceneId: SCENE_ID,
      bindings: bound(creature, OTHER_SCENE_ID),
      convex: true,
      room: true
    },
    {
      name: 'a creature whose token the map draws',
      actor: creature,
      sceneId: SCENE_ID,
      bindings: bound(creature),
      drawn: [TOKEN_ID],
      convex: true,
      room: false
    },
    {
      name: 'a creature whose token is hidden or in fog',
      actor: creature,
      sceneId: SCENE_ID,
      bindings: bound(creature),
      drawn: [],
      convex: true,
      room: true
    }
  ]

  it.each(cases)('$name', ({ actor, sceneId, bindings, drawn, convex, room }) => {
    const input = { actors: [actor], sceneId, bindings }

    expect(unseenEncounterActorIds({ ...input, visibleTokenIds: null }).has(actor.id)).toBe(convex)
    expect(
      unseenEncounterActorIds({ ...input, visibleTokenIds: new Set(drawn) }).has(actor.id)
    ).toBe(room)
  })

  it('never hides in the room what the fail-closed reads list', () => {
    for (const { actor, sceneId, bindings, drawn } of cases) {
      const input = { actors: [actor], sceneId, bindings }
      const convexListed = !unseenEncounterActorIds({ ...input, visibleTokenIds: null }).has(
        actor.id
      )
      const roomListed = !unseenEncounterActorIds({
        ...input,
        visibleTokenIds: new Set(drawn)
      }).has(actor.id)

      expect(!convexListed || roomListed).toBe(true)
    }
  })

  it('gives the GM a concealment with its observers and gives no viewer but the GM any trace of it (D116)', () => {
    const concealment = {
      effectId: '00000000-0000-4000-8000-0000000000a1',
      concealmentTotal: 17,
      observerActorIds: [HIDDEN_ACTOR_ID, CHARACTER_ACTOR_ID]
    }
    const gm = gmEncounter([{ ...gmActor(PUBLIC_ACTOR_ID, true), concealment }])

    expect(gm.actors[0]?.concealment).toEqual(concealment)
    for (const viewer of [{ ...noCharacters, userId: PLAYER_ID }, noCharacters]) {
      const projection = projectPlayerEncounterProjection(gm, viewer)
      expect(projection.actors[0]).not.toHaveProperty('concealment')
      const serialized = JSON.stringify(projection)
      expect(serialized).not.toContain(concealment.effectId)
      expect(serialized).not.toContain(HIDDEN_ACTOR_ID)
      expect(serialized).not.toContain('observerActorIds')
    }
  })
})
