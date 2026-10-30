import { describe, expect, it } from 'vitest'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { projectPlayerEncounterProjection } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { characterProjectionState } from '../characterStates.js'

const ID = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`
const consequence = {
  id: ID(10),
  definitionId: ID(11),
  rowId: ID(12),
  tableLabel: 'Aftermath table',
  label: 'Shattered knee',
  effect: 'Speed is halved until healed.',
  healing: 'Magical healing or a month of rest.',
  recordedAt: '2026-08-07T00:00:00.000Z'
}

describe('a Character consequence on the Encounter actor (ATTACK-15, VTT_UI-2.1)', () => {
  it('reaches a player viewer by label alone, never its effect, healing or table', () => {
    const { consequences, current, maximum, temporary, conditions } = characterProjectionState(
      {
        hitpoints: { current: 6, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES },
        consequences: [consequence]
      },
      10
    )
    const gm = encounterGmProjectionDtoSchema.parse({
      id: ID(1),
      campaignId: ID(2),
      gameSystemId: ID(3),
      blueprintId: ID(4),
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      name: 'Ambush',
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      healthDisplayDefault: 'HIDDEN',
      version: 1,
      round: 1,
      currentActorId: null,
      actors: [
        {
          id: ID(5),
          encounterId: ID(1),
          kind: 'CHARACTER',
          label: 'Aria',
          sourceId: ID(6),
          sourceRevision: null,
          public: true,
          controllerUserIds: [],
          disposition: 'FRIENDLY',
          initiative: 10,
          manualOrder: null,
          conditions,
          consequences,
          healthBand: 'WOUNDED',
          healthDisplay: null,
          systemId: null,
          stableTieKey: ID(5),
          currentHitPoints: current,
          maxHitPoints: maximum,
          tempHitPoints: temporary,
          defeated: false,
          absence: null,
          resources: {},
          gmNotes: null,
          statBlock: null,
          features: []
        }
      ],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })

    const player = projectPlayerEncounterProjection(gm, {
      userId: ID(7),
      characters: new Map(),
      unseenActorIds: new Set<string>(),
      unseenConditionTypeIds: new Set<string>()
    })

    expect(player.actors[0]?.consequences).toEqual([
      { id: consequence.id, label: 'Shattered knee' }
    ])
    const serialized = JSON.stringify(player)
    for (const hidden of [consequence.effect, consequence.healing, consequence.tableLabel])
      expect(serialized).not.toContain(hidden)
  })
})
