import { describe, expect, it } from 'vitest'

import {
  liveSessionCommandDtoSchema,
  liveSessionCommittedDtoSchema,
  liveSessionJoinOptionsDtoSchema
} from '../api/liveSessions.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  session: '00000000-0000-4000-8000-000000000002',
  character: '00000000-0000-4000-8000-000000000003',
  encounter: '00000000-0000-4000-8000-000000000004',
  command: '00000000-0000-4000-8000-000000000005'
} as const

describe('live-session contracts', () => {
  it('accepts exact room identity and existing Character or Encounter commands', () => {
    expect(
      liveSessionJoinOptionsDtoSchema.parse({
        campaignId: ids.campaign,
        sessionId: ids.session
      })
    ).toEqual({ campaignId: ids.campaign, sessionId: ids.session })

    expect(
      liveSessionCommandDtoSchema.parse({
        aggregateKind: 'CHARACTER',
        characterId: ids.character,
        command: {
          type: 'SET_INSPIRATION',
          commandId: ids.command,
          expectedVersion: 3,
          inspired: true
        }
      }).aggregateKind
    ).toBe('CHARACTER')
    expect(
      liveSessionCommandDtoSchema.parse({
        aggregateKind: 'ENCOUNTER',
        command: {
          type: 'ADVANCE_TURN',
          encounterId: ids.encounter,
          commandId: ids.command,
          expectedVersion: 4
        }
      }).aggregateKind
    ).toBe('ENCOUNTER')
  })

  it('keeps committed broadcasts aggregate-only', () => {
    expect(
      liveSessionCommittedDtoSchema.parse({
        aggregateKind: 'CHARACTER',
        aggregateId: ids.character,
        version: 4,
        commandId: ids.command,
        roomVersion: 9
      })
    ).toEqual({
      aggregateKind: 'CHARACTER',
      aggregateId: ids.character,
      version: 4,
      commandId: ids.command,
      roomVersion: 9
    })
  })
})
