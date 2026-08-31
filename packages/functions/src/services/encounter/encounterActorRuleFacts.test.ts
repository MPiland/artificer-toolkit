import { describe, expect, it } from 'vitest'

import type { EncounterRecord } from '@artificer-toolkit/db'

import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import { refreshEncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'

const encounter = {
  id: '00000000-0000-4000-8000-000000000001',
  campaignId: '00000000-0000-4000-8000-000000000002',
  sessionId: '00000000-0000-4000-8000-000000000003',
  gameSystemId: '00000000-0000-4000-8000-000000000004',
  blueprintId: '00000000-0000-4000-8000-000000000004',
  blueprintVersion: 1,
  blueprintChecksum: 'a'.repeat(64),
  rulePackRevisionId: '00000000-0000-4000-8000-000000000005',
  automationMode: 'ASSISTED',
  manualReminderMode: 'OFF',
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
          damageImmunities: [],
          damageResistances: [],
          damageVulnerabilities: [],
          conditionImmunities: [],
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
          targetProtection: {
            status: 'NORMALIZED',
            defenses: [],
            conditionImmunityIds: []
          },
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

  it('requires complete, UUID-only Creature protection collections and never parses display strings', () => {
    const fire = '00000000-0000-4000-8000-000000000011'
    const poisoned = '00000000-0000-4000-8000-000000000012'
    const normalized = {
      ...encounter,
      actors: [
        {
          ...encounter.actors[0],
          snapshot: {
            payload: {
              ...encounter.actors[0].snapshot.payload,
              damageImmunities: [fire],
              conditionImmunities: [poisoned]
            }
          }
        }
      ]
    } satisfies EncounterRecord
    expect(buildEncounterActorRuleFacts(normalized).actors[0]?.targetProtection).toEqual({
      status: 'NORMALIZED',
      defenses: [{ kind: 'IMMUNITY', damageTypeId: fire }],
      conditionImmunityIds: [poisoned]
    })

    const duplicate = {
      ...normalized,
      actors: [
        {
          ...normalized.actors[0],
          snapshot: {
            payload: {
              ...normalized.actors[0].snapshot.payload,
              damageImmunities: [fire, fire]
            }
          }
        }
      ]
    } satisfies EncounterRecord
    expect(buildEncounterActorRuleFacts(duplicate).actors[0]?.targetProtection).toEqual({
      status: 'NOT_NORMALIZED'
    })

    const raw = {
      ...normalized,
      actors: [
        {
          ...normalized.actors[0],
          snapshot: {
            payload: {
              ...normalized.actors[0].snapshot.payload,
              damageImmunities: ['fire']
            }
          }
        }
      ]
    } satisfies EncounterRecord
    expect(buildEncounterActorRuleFacts(raw).actors[0]?.targetProtection).toEqual({
      status: 'NOT_NORMALIZED'
    })

    const absent = {
      ...encounter,
      actors: [
        {
          ...encounter.actors[0],
          snapshot: { payload: { abilityScores: { DEXTERITY: 14 } } }
        }
      ]
    } satisfies EncounterRecord
    expect(buildEncounterActorRuleFacts(absent).actors[0]?.targetProtection).toEqual({
      status: 'NOT_NORMALIZED'
    })

    const partial = {
      ...absent,
      actors: [
        {
          ...absent.actors[0],
          snapshot: {
            payload: {
              abilityScores: { DEXTERITY: 14 },
              damageImmunities: [],
              damageResistances: [],
              damageVulnerabilities: []
            }
          }
        }
      ]
    } satisfies EncounterRecord
    expect(buildEncounterActorRuleFacts(partial).actors[0]?.targetProtection).toEqual({
      status: 'NOT_NORMALIZED'
    })

    const nonArray = {
      ...normalized,
      actors: [
        {
          ...normalized.actors[0],
          snapshot: {
            payload: {
              ...normalized.actors[0].snapshot.payload,
              conditionImmunities: { id: poisoned }
            }
          }
        }
      ]
    } satisfies EncounterRecord
    expect(buildEncounterActorRuleFacts(nonArray).actors[0]?.targetProtection).toEqual({
      status: 'NOT_NORMALIZED'
    })

    const custom = {
      ...encounter,
      actors: [{ ...encounter.actors[0], kind: 'CUSTOM', snapshot: null }]
    } satisfies EncounterRecord
    expect(buildEncounterActorRuleFacts(custom).actors[0]?.targetProtection).toEqual({
      status: 'NORMALIZED',
      defenses: [],
      conditionImmunityIds: []
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
                targetProtection: {
                  status: 'NORMALIZED',
                  defenses: [],
                  conditionImmunityIds: []
                },
                featureResources: [
                  {
                    featureId: 'resistance',
                    maximum: 3,
                    reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
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
            targetProtection: {
              status: 'NORMALIZED',
              defenses: [],
              conditionImmunityIds: []
            },
            featureResources: [
              {
                featureId: 'resistance',
                maximum: 3,
                reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
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
