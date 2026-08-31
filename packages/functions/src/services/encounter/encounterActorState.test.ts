import { describe, expect, it } from 'vitest'

import type { EncounterActorRecord } from '@artificer-toolkit/db'

import {
  encounterRuleUsageSnapshot,
  encounterRuleUsageUsed,
  withEncounterRuleUsageUsed
} from './encounterActorState.js'

const DEFINITION_ID = '11111111-1111-4111-8111-111111111111'

function actor(resources: EncounterActorRecord['resources'] = {}): EncounterActorRecord {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    encounterId: '33333333-3333-4333-8333-333333333333',
    kind: 'CUSTOM',
    sourceId: null,
    sourceRevision: null,
    label: 'Fixture',
    systemId: null,
    stableTieKey: 'fixture',
    initiative: null,
    manualOrder: null,
    public: true,
    currentHitPoints: 1,
    maxHitPoints: 1,
    tempHitPoints: 0,
    conditions: [],
    resources,
    gmNotes: null,
    snapshot: null,
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z'
  }
}

describe('Encounter actor rule usage state', () => {
  it('treats an absent System-defined usage marker as unused', () => {
    expect(encounterRuleUsageUsed(actor(), DEFINITION_ID)).toBe(0)
  })

  it('writes one UUID-keyed usage value without replacing other actor resources', () => {
    const current = actor({ featureCharges: { feature: 1 } })
    const resources = withEncounterRuleUsageUsed(current, DEFINITION_ID.toUpperCase(), 1)

    expect(resources).toEqual({
      featureCharges: { feature: 1 },
      ruleUsage: { [DEFINITION_ID]: 1 }
    })
    expect(encounterRuleUsageUsed({ ...current, resources }, DEFINITION_ID)).toBe(1)
  })

  it('returns canonical raw usage for System policy without selecting semantics', () => {
    const second = '22222222-2222-4222-8222-222222222221'
    expect(
      encounterRuleUsageSnapshot(
        actor({ ruleUsage: { [second.toUpperCase()]: 2, [DEFINITION_ID]: 1 } })
      )
    ).toEqual({ [DEFINITION_ID]: 1, [second]: 2 })
  })

  it('fails closed for malformed stored state or an invalid proposed value', () => {
    expect(() => encounterRuleUsageUsed(actor({ ruleUsage: [] }), DEFINITION_ID)).toThrow(
      'Encounter rule usage state is invalid.'
    )
    expect(() =>
      encounterRuleUsageUsed(actor({ ruleUsage: { [DEFINITION_ID]: -1 } }), DEFINITION_ID)
    ).toThrow('Encounter rule usage value is invalid.')
    expect(() => withEncounterRuleUsageUsed(actor(), DEFINITION_ID, Number.NaN)).toThrow(
      'Encounter rule usage value must be a nonnegative safe integer.'
    )
  })
})
