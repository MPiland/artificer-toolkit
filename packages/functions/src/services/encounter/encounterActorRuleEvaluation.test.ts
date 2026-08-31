import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike, EncounterRecord } from '@artificer-toolkit/db'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  revision: '00000000-0000-4000-8000-000000000003',
  session: '00000000-0000-4000-8000-000000000004',
  system: '00000000-0000-4000-8000-000000000006',
  template: '00000000-0000-4000-8000-000000000005'
}

const mocks = vi.hoisted(() => ({
  evaluate: vi.fn(),
  resolveActive: vi.fn()
}))

vi.mock('../rules/ruleRevisionRuntime.js', () => ({
  evaluateRuleRevision: mocks.evaluate
}))
vi.mock('./encounterRuleIdentity.js', () => ({
  encounterSystemIds: () => [],
  resolveActiveRulePackForSystems: mocks.resolveActive
}))

const { evaluateEncounterActorRuleSnapshot } = await import('./encounterActorRuleEvaluation.js')

function encounter(status: EncounterRecord['status'], revisionId: string | null): EncounterRecord {
  return {
    id: ids.encounter,
    campaignId: ids.campaign,
    sessionId: ids.session,
    gameSystemId: ids.system,
    blueprintId: ids.template,
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    rulePackRevisionId: revisionId,
    automationMode: 'ASSISTED',
    manualReminderMode: 'OFF',
    name: 'Encounter',
    status,
    version: 1,
    round: 0,
    currentActorId: null,
    actors: [],
    reminders: [],
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z'
  }
}

describe('Encounter actor rule evaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.evaluate.mockResolvedValue({ result: { actors: [] } })
    mocks.resolveActive.mockResolvedValue({ revision: { id: ids.revision } })
  })

  it('previews an unpinned prepared Encounter with the current compatible revision', async () => {
    await expect(
      evaluateEncounterActorRuleSnapshot({
        db: {} as DBLike,
        encounter: encounter('PREPARED', null)
      })
    ).resolves.toMatchObject({ snapshot: { output: { actors: [] } } })
    expect(mocks.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ revisionId: ids.revision })
    )
  })

  it('fails closed for an unpinned active Encounter', async () => {
    await expect(
      evaluateEncounterActorRuleSnapshot({
        db: {} as DBLike,
        encounter: encounter('ACTIVE', null)
      })
    ).rejects.toThrow('does not have a pinned rule revision')
    expect(mocks.evaluate).not.toHaveBeenCalled()
  })

  it('reconciles a System-selected finite resource through production evaluation', async () => {
    const actorId = '00000000-0000-4000-8000-000000000007'
    const resourceEncounter = {
      ...encounter('ACTIVE', ids.revision),
      actors: [
        {
          id: actorId,
          encounterId: ids.encounter,
          kind: 'CREATURE' as const,
          sourceId: '00000000-0000-4000-8000-000000000008',
          sourceRevision: 1,
          label: 'Resource creature',
          systemId: ids.system,
          stableTieKey: 'resource-creature',
          public: true,
          currentHitPoints: 10,
          maxHitPoints: 10,
          tempHitPoints: 0,
          conditions: [],
          resources: {
            featureCharges: { resource: 4 },
            unrelated: { retained: true }
          },
          gmNotes: null,
          initiative: null,
          manualOrder: null,
          snapshot: {
            payload: {
              features: [
                {
                  id: 'resource',
                  label: 'Resource',
                  description: '<p>Resource</p>',
                  order: 0,
                  charges: {
                    id: 'resource-charge',
                    resetKind: 'DAILY',
                    limitKind: 'FIXED_AMOUNT',
                    scalingKind: 'NONE',
                    amount: 2
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
    mocks.evaluate.mockResolvedValue({
      result: {
        actors: [
          {
            actorId,
            initiativeModifier: 0,
            targetProtection: { status: 'NOT_NORMALIZED' },
            featureResources: [
              {
                featureId: 'resource',
                maximum: 2,
                reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
                rawUsed: 4,
                used: 4,
                remaining: 0,
                resetKind: 'DAILY'
              }
            ]
          }
        ]
      },
      evaluationDurationMs: 1
    })

    const first = await evaluateEncounterActorRuleSnapshot({
      db: {} as DBLike,
      encounter: resourceEncounter
    })
    expect(first).toMatchObject({
      snapshot: {
        output: {
          actors: [
            {
              actorId,
              featureResources: [
                {
                  maximum: 2,
                  reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
                  rawUsed: 2,
                  used: 2,
                  remaining: 0
                }
              ]
            }
          ]
        },
        facts: {
          actors: [
            {
              actorId,
              featureResources: [{ featureId: 'resource', used: 2 }]
            }
          ]
        }
      },
      reconciledEncounter: {
        actors: [
          {
            resources: {
              featureCharges: { resource: 2 },
              unrelated: { retained: true }
            }
          }
        ]
      },
      actorUpdates: [
        {
          id: actorId,
          resources: {
            featureCharges: { resource: 2 },
            unrelated: { retained: true }
          }
        }
      ]
    })

    mocks.evaluate.mockResolvedValue({
      result: {
        actors: [
          {
            actorId,
            initiativeModifier: 0,
            targetProtection: { status: 'NOT_NORMALIZED' },
            featureResources: [
              {
                featureId: 'resource',
                maximum: 5,
                reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
                rawUsed: 2,
                used: 2,
                remaining: 3,
                resetKind: 'DAILY'
              }
            ]
          }
        ]
      },
      evaluationDurationMs: 1
    })
    const increased = await evaluateEncounterActorRuleSnapshot({
      db: {} as DBLike,
      encounter: first.reconciledEncounter,
      previousSnapshot: first.snapshot
    })
    expect(increased.snapshot.output.actors[0]?.featureResources[0]).toMatchObject({
      maximum: 5,
      used: 2,
      remaining: 3
    })
    expect(increased.actorUpdates).toEqual([])

    mocks.evaluate.mockResolvedValue({
      result: {
        actors: [
          {
            actorId,
            initiativeModifier: 0,
            targetProtection: { status: 'NOT_NORMALIZED' },
            featureResources: [
              {
                featureId: 'resource',
                maximum: 0,
                reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
                rawUsed: 2,
                used: 2,
                remaining: 0,
                resetKind: 'DAILY'
              }
            ]
          }
        ]
      },
      evaluationDurationMs: 1
    })
    const zero = await evaluateEncounterActorRuleSnapshot({
      db: {} as DBLike,
      encounter: increased.reconciledEncounter,
      previousSnapshot: increased.snapshot
    })
    expect(zero).toMatchObject({
      snapshot: {
        facts: {
          actors: [{ actorId, featureResources: [{ featureId: 'resource', used: 0 }] }]
        },
        output: { actors: [{ featureResources: [{ maximum: 0, rawUsed: 0, used: 0 }] }] }
      },
      reconciledEncounter: { actors: [{ resources: { featureCharges: { resource: 0 } } }] }
    })

    mocks.evaluate.mockResolvedValue({
      result: {
        actors: [
          {
            actorId,
            initiativeModifier: 0,
            targetProtection: { status: 'NOT_NORMALIZED' },
            featureResources: [
              {
                featureId: 'resource',
                maximum: null,
                reconciliationPolicy: null,
                rawUsed: 4,
                used: 0,
                remaining: null,
                resetKind: null
              }
            ]
          }
        ]
      },
      evaluationDurationMs: 1
    })
    const unbounded = await evaluateEncounterActorRuleSnapshot({
      db: {} as DBLike,
      encounter: resourceEncounter
    })
    expect(unbounded).toMatchObject({
      snapshot: {
        output: {
          actors: [
            {
              featureResources: [{ maximum: null, rawUsed: 4, used: 0, remaining: null }]
            }
          ]
        }
      },
      reconciledEncounter: {
        actors: [{ resources: { featureCharges: { resource: 4 } } }]
      },
      actorUpdates: []
    })
  })

  it('fails closed when a finite resource omits its System reconciliation policy', async () => {
    const actorId = '00000000-0000-4000-8000-000000000009'
    const policylessEncounter = {
      ...encounter('ACTIVE', ids.revision),
      actors: [
        {
          id: actorId,
          encounterId: ids.encounter,
          kind: 'CREATURE' as const,
          sourceId: '00000000-0000-4000-8000-000000000010',
          sourceRevision: 1,
          label: 'Policyless creature',
          systemId: ids.system,
          stableTieKey: 'policyless-creature',
          public: true,
          currentHitPoints: 10,
          maxHitPoints: 10,
          tempHitPoints: 0,
          conditions: [],
          resources: { featureCharges: { resource: 0 } },
          gmNotes: null,
          initiative: null,
          manualOrder: null,
          snapshot: {
            payload: {
              features: [
                {
                  id: 'resource',
                  label: 'Resource',
                  description: '<p>Resource</p>',
                  order: 0,
                  charges: {
                    id: 'resource-charge',
                    resetKind: 'DAILY',
                    limitKind: 'FIXED_AMOUNT',
                    scalingKind: 'NONE',
                    amount: 2
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
    mocks.evaluate.mockResolvedValue({
      result: {
        actors: [
          {
            actorId,
            initiativeModifier: 0,
            targetProtection: { status: 'NOT_NORMALIZED' },
            featureResources: [
              {
                featureId: 'resource',
                maximum: 2,
                reconciliationPolicy: null,
                rawUsed: 0,
                used: 0,
                remaining: 2,
                resetKind: 'DAILY'
              }
            ]
          }
        ]
      },
      evaluationDurationMs: 1
    })
    await expect(
      evaluateEncounterActorRuleSnapshot({
        db: {} as DBLike,
        encounter: policylessEncounter
      })
    ).rejects.toThrow('finite state is incomplete')
  })
})
