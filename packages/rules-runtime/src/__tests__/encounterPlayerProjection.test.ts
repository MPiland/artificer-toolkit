import { describe, expect, it } from 'vitest'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import type { HealthDisplayLevelDto } from '@artificer-toolkit/schema/api/healthDisplay'

import {
  healthDescriptiveState,
  playerActorHealth,
  projectPlayerEncounterProjection
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
    manualReminderMode: 'OFF',
    healthDisplayDefault,
    version: 4,
    round: 1,
    currentActorId: null,
    actors,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z'
  })
}

const noCharacters = { userId: OTHER_PLAYER_ID, characters: new Map() }

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
      manualReminderMode: 'OFF',
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
      userId: PLAYER_ID,
      characters: new Map()
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
      projectPlayerEncounterProjection(gm, { userId: OTHER_PLAYER_ID, characters }).actors[0]
        ?.health
    ).toEqual({ level: 'DESCRIPTIVE', state: 'BLOODIED' })
    expect(
      projectPlayerEncounterProjection(gm, { userId: PLAYER_ID, characters }).actors[0]?.health
    ).toEqual({ level: 'EXACT', current: 3, maximum: 7 })
    expect(projectPlayerEncounterProjection(gm, noCharacters).actors[0]?.health).toBeNull()
  })
})
