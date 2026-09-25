import { describe, expect, it } from 'vitest'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'

import { projectPlayerEncounterProjection } from '../encounterPlayerProjection.js'

const ENCOUNTER_ID = '00000000-0000-4000-8000-000000000001'
const CAMPAIGN_ID = '00000000-0000-4000-8000-000000000002'
const PUBLIC_ACTOR_ID = '00000000-0000-4000-8000-000000000003'
const HIDDEN_ACTOR_ID = '00000000-0000-4000-8000-000000000004'
const PLAYER_ID = '00000000-0000-4000-8000-000000000005'

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
      rulePackRevisionId: null,
      version: 4,
      round: 1,
      currentActorId: HIDDEN_ACTOR_ID,
      actors: [gmActor(PUBLIC_ACTOR_ID, true), gmActor(HIDDEN_ACTOR_ID, false)],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })

    const player = projectPlayerEncounterProjection(gm)

    expect(player.currentActorId).toBeNull()
    expect(player.actors.map((actor) => actor.id)).toEqual([PUBLIC_ACTOR_ID])
    expect(player.actors[0]).toMatchObject({
      controllerUserIds: [PLAYER_ID],
      disposition: 'NEUTRAL'
    })
    for (const field of ['healthBand', 'currentHitPoints', 'gmNotes', 'resources'])
      expect(player.actors[0]).not.toHaveProperty(field)
  })
})
