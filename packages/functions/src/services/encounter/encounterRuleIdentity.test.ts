import { describe, expect, it } from 'vitest'

import type { EncounterRecord } from '@artificer-toolkit/db'

import { encounterSystemIds } from './encounterRuleIdentity.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  system: '00000000-0000-4000-8000-000000000003',
  blueprint: '00000000-0000-4000-8000-000000000004'
}

describe('Encounter rule identity', () => {
  it('uses the normalized Encounter System for a Custom-only run', () => {
    const encounter = {
      id: ids.encounter,
      campaignId: ids.campaign,
      sessionId: ids.encounter,
      gameSystemId: ids.system,
      blueprintId: ids.blueprint,
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      rulePackRevisionId: null,
      automationMode: 'ASSISTED',
      manualReminderMode: 'OFF',
      name: 'Custom run',
      status: 'PREPARED',
      version: 0,
      round: 0,
      currentActorId: null,
      actors: [
        {
          id: ids.blueprint,
          encounterId: ids.encounter,
          kind: 'CUSTOM',
          sourceId: null,
          sourceRevision: null,
          label: 'Custom actor',
          systemId: ids.system,
          stableTieKey: ids.blueprint,
          public: true,
          currentHitPoints: 1,
          maxHitPoints: 1,
          tempHitPoints: 0,
          conditions: [],
          resources: {},
          gmNotes: null,
          initiative: null,
          manualOrder: null,
          snapshot: { kind: 'CUSTOM', systemId: ids.system },
          createdAt: '2026-08-25T00:00:00.000Z',
          updatedAt: '2026-08-25T00:00:00.000Z'
        }
      ],
      reminders: [],
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z'
    } satisfies EncounterRecord

    expect(encounterSystemIds(encounter)).toEqual([ids.system, ids.system])
  })
})
