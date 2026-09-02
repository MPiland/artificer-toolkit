import { describe, expect, it } from 'vitest'

import { buildCharacterHistoryView } from '../domains/character/historyView.js'

describe('buildCharacterHistoryView', () => {
  it('projects a generic rules-runtime equipment state transition', () => {
    const history = buildCharacterHistoryView([
      {
        type: 'CHARACTER_RULE_EQUIPMENT_STATE_APPLIED',
        eventId: 'event-1',
        characterId: 'character-1',
        occurredAt: '2026-08-31T00:00:00.000Z',
        actorId: 'actor-1',
        commandId: 'child-command-1',
        schemaVersion: 1,
        encounterId: 'encounter-1',
        occurrenceId: 'occurrence-1',
        sourceCommandId: 'source-command-1',
        commandFingerprint: 'c'.repeat(64),
        committedStreamVersion: 2,
        itemInstanceId: 'item-1',
        fromState: 'EQUIPPED',
        toState: 'CARRIED',
        beforeStateChecksum: 'a'.repeat(64),
        afterStateChecksum: 'b'.repeat(64)
      }
    ])

    expect(history.entries).toEqual([
      expect.objectContaining({
        actorId: 'actor-1',
        eventType: 'CHARACTER_RULE_EQUIPMENT_STATE_APPLIED',
        summary: 'Rule equipment state applied'
      })
    ])
  })
})
