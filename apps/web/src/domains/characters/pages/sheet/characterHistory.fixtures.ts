import type { CharacterHistoryResponseDto } from '@artificer-toolkit/schema/api/characters'
import { characterFixture } from '../../builder/fixtures/characterBuilder.fixtures'

export const characterHistoryFixture = {
  characterId: characterFixture.id,
  entries: [
    {
      eventId: 'history-1',
      occurredAt: '2026-05-05T14:15:00.000Z',
      actorId: 'user-1',
      eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
      summary: 'Shield marked prepared for Wizard'
    },
    {
      eventId: 'history-2',
      occurredAt: '2026-05-05T13:58:00.000Z',
      actorId: 'user-1',
      eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
      summary: '1 Level 2 spell slot restored'
    },
    {
      eventId: 'history-3',
      occurredAt: '2026-05-05T13:44:00.000Z',
      actorId: 'user-1',
      eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
      summary: 'Poisoned added'
    },
    {
      eventId: 'history-4',
      occurredAt: '2026-05-05T13:30:00.000Z',
      actorId: 'user-1',
      eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
      summary: 'Quarterstaff quantity reduced by 1'
    }
  ]
} satisfies CharacterHistoryResponseDto
