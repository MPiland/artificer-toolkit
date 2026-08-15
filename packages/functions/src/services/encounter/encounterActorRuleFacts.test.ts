import { describe, expect, it } from 'vitest'

import type { EncounterRecord } from '@artificer-toolkit/db'

import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import { refreshEncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'

const encounter = {
  id: '00000000-0000-4000-8000-000000000001',
  campaignId: '00000000-0000-4000-8000-000000000002',
  sessionId: '00000000-0000-4000-8000-000000000003',
  templateId: '00000000-0000-4000-8000-000000000004',
  templateVersion: 1,
  rulePackRevisionId: '00000000-0000-4000-8000-000000000005',
  name: 'Encounter',
  status: 'ACTIVE',
  version: 1,
  round: 1,
  currentActorId: null,
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  reminders: [],
  actors: [
    {
      id: '00000000-0000-4000-8000-000000000006',
      encounterId: '00000000-0000-4000-8000-000000000001',
      kind: 'CREATURE',
      sourceId: '00000000-0000-4000-8000-000000000007',
      sourceRevision: 1,
      label: 'Enemy',
      systemId: '00000000-0000-4000-8000-000000000008',
      stableTieKey: 'enemy',
      public: true,
      currentHitPoints: 10,
      maxHitPoints: 10,
      tempHitPoints: 0,
      conditions: [],
      resources: { featureCharges: { resistance: 2 } },
      gmNotes: null,
      initiative: null,
      manualOrder: null,
      snapshot: {
        payload: {
          abilityScores: { DEXTERITY: 14, UNKNOWN: 20 },
          features: [
            {
              id: 'resistance',
              label: 'Resistance',
              description: '<p>Resist a failed save.</p>',
              order: 0,
              charges: {
                id: 'resistance-charge',
                resetKind: 'DAILY',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 3
              }
            }
          ]
        }
      },
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z'
    }
  ]
} satisfies EncounterRecord

describe('Encounter actor rule facts', () => {
  it('projects only raw supported actor snapshot and usage facts', () => {
    expect(buildEncounterActorRuleFacts(encounter)).toEqual({
      contractVersion: 1,
      actors: [
        {
          actorId: '00000000-0000-4000-8000-000000000006',
          abilityScores: { DEXTERITY: 14 },
          featureResources: [
            {
              featureId: 'resistance',
              charge: {
                id: 'resistance-charge',
                resetKind: 'DAILY',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 3
              },
              used: 2
            }
          ]
        }
      ]
    })
  })

  it('refreshes mutable usage from the committed Zen maximum without reevaluating mechanics', () => {
    const facts = buildEncounterActorRuleFacts(encounter)
    const updated = {
      ...encounter,
      version: 2,
      actors: encounter.actors.map((actor) => ({
        ...actor,
        resources: { featureCharges: { resistance: 3 } }
      }))
    } satisfies EncounterRecord

    expect(
      refreshEncounterActorRuleSnapshot(
        {
          encounterVersion: encounter.version,
          revisionId: encounter.rulePackRevisionId,
          facts,
          output: {
            actors: [
              {
                actorId: encounter.actors[0].id,
                initiativeModifier: 2,
                featureResources: [
                  {
                    featureId: 'resistance',
                    maximum: 3,
                    rawUsed: 2,
                    used: 2,
                    remaining: 1,
                    resetKind: 'DAILY'
                  }
                ]
              }
            ]
          }
        },
        updated
      )
    ).toEqual({
      encounterVersion: 2,
      revisionId: encounter.rulePackRevisionId,
      facts: {
        ...facts,
        actors: [
          {
            ...facts.actors[0],
            featureResources: [{ ...facts.actors[0].featureResources[0], used: 3 }]
          }
        ]
      },
      output: {
        actors: [
          {
            actorId: encounter.actors[0].id,
            initiativeModifier: 2,
            featureResources: [
              {
                featureId: 'resistance',
                maximum: 3,
                rawUsed: 3,
                used: 3,
                remaining: 0,
                resetKind: 'DAILY'
              }
            ]
          }
        ]
      }
    })
  })
})
