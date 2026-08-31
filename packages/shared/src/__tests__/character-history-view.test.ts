import { describe, expect, it } from 'vitest'
import { buildCharacterHistoryView } from '../domains/character/historyView.js'

describe('character history view', () => {
  it('uses the requested character id when there are no events yet', () => {
    expect(buildCharacterHistoryView([], 'character-1')).toEqual({
      characterId: 'character-1',
      entries: []
    })
  })

  it('summarises one ordered rule-application envelope', () => {
    const eventBase = {
      type: 'CHARACTER_RULE_OUTCOME_APPLIED' as const,
      eventId: 'event-1',
      characterId: 'character-1',
      occurredAt: '2026-08-26T00:00:00.000Z',
      actorId: 'user-1',
      commandId: 'command-1',
      sourceCommandId: 'source-command-1',
      schemaVersion: 1 as const,
      encounterId: 'encounter-1',
      occurrenceId: 'occurrence-1',
      committedStreamVersion: 2,
      targetActorId: 'actor-1',
      applications: [
        {
          ordinal: 0,
          outcome: 'CONDITION_APPLY' as const,
          conditionId: 'condition-1',
          beforePresent: false,
          afterPresent: true as const,
          applied: true
        }
      ]
    }

    const history = buildCharacterHistoryView([
      eventBase,
      {
        ...eventBase,
        eventId: 'event-2',
        applications: [
          { ordinal: 0, outcome: 'DAMAGE' as const, appliedAmount: 4, damageTypeId: 'damage-1' },
          {
            ordinal: 1,
            outcome: 'CONDITION_APPLY' as const,
            conditionId: 'condition-1',
            beforePresent: true,
            afterPresent: true as const,
            applied: false
          }
        ]
      }
    ])

    expect(history.entries.map((entry) => entry.summary)).toEqual([
      'Rule outcomes applied: 1 result',
      'Rule outcomes applied: 2 results'
    ])
  })
})
