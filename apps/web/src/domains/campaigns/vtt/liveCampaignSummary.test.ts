import { describe, expect, it } from 'vitest'
import {
  liveCampaignSummaryDtoSchema,
  type LiveCampaignSummaryDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { mergeEncounterSummary, resolveHitPoints } from './liveCampaignSummary'

const characterId = '00000000-0000-4000-8000-000000000001'
const encounterId = '00000000-0000-4000-8000-000000000002'
const actorId = '00000000-0000-4000-8000-000000000003'

const summary = (overrides: Partial<LiveCampaignSummaryDto> = {}): LiveCampaignSummaryDto =>
  liveCampaignSummaryDtoSchema.parse({
    characters: [
      {
        characterId,
        currentHitPoints: 4,
        maxHitPoints: 20,
        tempHitPoints: 0,
        conditions: []
      }
    ],
    encounter: { encounterId, status: 'ACTIVE', round: 3, currentActorId: null },
    ...overrides
  })

describe('resolveHitPoints', () => {
  const stored = { currentHitPoints: 18, maxHitPoints: 20 }

  it('prefers the room for a Character it provides', () => {
    expect(resolveHitPoints(summary(), characterId, stored)).toEqual({
      currentHitPoints: 4,
      maxHitPoints: 20
    })
  })

  it('keeps Convex for a Character the room leaves out and with no summary', () => {
    expect(resolveHitPoints(summary({ characters: [] }), characterId, stored)).toBe(stored)
    expect(resolveHitPoints(null, characterId, stored)).toBe(stored)
    expect(resolveHitPoints(summary({ characters: [] }), characterId, undefined)).toBeUndefined()
  })

  it('shows the room value before Convex has loaded', () => {
    expect(resolveHitPoints(summary(), characterId, undefined)).toEqual({
      currentHitPoints: 4,
      maxHitPoints: 20
    })
  })
})

describe('mergeEncounterSummary', () => {
  const stored = { id: encounterId, round: 1, status: 'PREPARED' as const }
  const other = { id: actorId, round: 1, status: 'PREPARED' as const }

  it('takes status and round from the room for its ACTIVE Run only', () => {
    expect(mergeEncounterSummary(summary(), stored)).toEqual({
      id: encounterId,
      round: 3,
      status: 'ACTIVE'
    })
    expect(mergeEncounterSummary(summary(), other)).toBe(other)
  })

  it('keeps every Convex Run when the room holds no ACTIVE Run', () => {
    expect(mergeEncounterSummary(summary({ encounter: null }), stored)).toBe(stored)
    expect(mergeEncounterSummary(null, stored)).toBe(stored)
  })

  it('never carries a current actor, so a hidden one stays hidden', () => {
    expect(Object.keys(mergeEncounterSummary(summary(), stored)).sort()).toEqual([
      'id',
      'round',
      'status'
    ])
  })
})
