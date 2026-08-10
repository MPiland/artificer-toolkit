import { describe, expect, it } from 'vitest'
import type { EncounterRecord } from '@artificer-toolkit/db'

import { projectGm } from './encounterProjection.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  creature: '00000000-0000-4000-8000-000000000003',
  system: '00000000-0000-4000-8000-000000000004',
  template: '00000000-0000-4000-8000-000000000005',
  command: '00000000-0000-4000-8000-000000000006'
}

describe('encounter projection', () => {
  it('projects immutable Creature actions to the GM', () => {
    const projection = projectGm({
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.command,
      templateId: ids.template,
      templateVersion: 1,
      name: 'Goblin ambush',
      status: 'ACTIVE',
      version: 1,
      round: 1,
      currentActorId: null,
      actors: [
        {
          id: ids.creature,
          encounterId: ids.command,
          kind: 'CREATURE',
          sourceId: ids.creature,
          sourceRevision: null,
          label: 'Server creature',
          systemId: ids.system,
          stableTieKey: ids.creature,
          public: true,
          currentHitPoints: 8,
          maxHitPoints: 8,
          tempHitPoints: 0,
          conditions: [],
          resources: { featureCharges: { scimitar: 1 } },
          gmNotes: null,
          initiative: 12,
          manualOrder: null,
          snapshot: {
            kind: 'CREATURE',
            payload: {
              features: [
                {
                  id: 'scimitar',
                  label: 'Scimitar',
                  description: '<p>Melee weapon attack.</p>',
                  section: 'ACTION',
                  order: 1,
                  charges: {
                    id: 'scimitar-charges',
                    resetKind: 'MANUAL',
                    limitKind: 'FIXED_AMOUNT',
                    scalingKind: 'NONE',
                    amount: 2
                  }
                }
              ]
            }
          },
          createdAt: '2026-08-07T00:00:00.000Z',
          updatedAt: '2026-08-07T00:00:00.000Z'
        }
      ],
      reminders: [],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    } satisfies EncounterRecord)

    expect(projection.actors[0]).toMatchObject({
      features: [
        {
          label: 'Scimitar',
          section: 'ACTION',
          resource: {
            used: 1,
            maximum: 2,
            remaining: 1,
            resetKind: 'MANUAL'
          }
        }
      ]
    })
  })
})
