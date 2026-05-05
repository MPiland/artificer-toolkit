import type { CharacterEvent } from './events/index.js'

export interface CharacterHistoryEntry {
  eventId: string
  occurredAt: string
  actorId: string
  eventType: string
  /** Human-readable English summary of what happened. */
  summary: string
}

export interface CharacterHistoryView {
  characterId: string
  entries: CharacterHistoryEntry[]
}

function summarise(event: CharacterEvent): string {
  switch (event.type) {
    case 'CHARACTER_CREATED':
      return `Character "${event.name}" created`
    case 'RACE_ASSIGNED':
      return `Race assigned`
    case 'BACKGROUND_ASSIGNED':
      return `Background assigned`
    case 'ABILITY_SCORES_GENERATED':
      return `Ability scores set (${event.method.toLowerCase().replace(/_/g, ' ')})`
    case 'ABILITY_SCORES_REPLACED':
      return `Ability scores updated`
    case 'CLASS_LEVEL_GAINED':
      return `Gained level ${event.newLevel} (total level ${event.totalCharacterLevel})`
    case 'HITPOINTS_APPLIED':
      return `Hit points applied at class level ${event.classLevel}: +${event.value} HP`
    case 'FEATURE_SELECTION_MADE':
      return `Feature choice made for "${event.featureId}"`
    case 'FEAT_CHOSEN':
      return `Feat chosen`
    case 'SPELL_SELECTION_UPDATED': {
      const added = event.added.length
      const removed = event.removed.length
      const parts: string[] = []
      if (added > 0) parts.push(`${added} spell${added > 1 ? 's' : ''} added`)
      if (removed > 0) parts.push(`${removed} spell${removed > 1 ? 's' : ''} removed`)
      return parts.length > 0 ? `Spells updated: ${parts.join(', ')}` : 'Spell selection unchanged'
    }
    case 'EQUIPMENT_ACQUIRED':
      return `Equipment acquired (qty ${event.quantity})`
    case 'EQUIPMENT_REMOVED':
      return `Equipment removed`
    case 'ITEM_EQUIPPED':
      return `Item equipped to ${event.equippedSlot}`
    case 'ITEM_UNEQUIPPED':
      return `Item unequipped from ${event.unequippedFromSlot}`
    case 'CHARACTER_SHEET_COMMAND_APPLIED':
      return event.summary
    default: {
      const _exhaustive: never = event
      return `Unknown event: ${(_exhaustive as { type: string }).type}`
    }
  }
}

export function buildCharacterHistoryView(
  events: CharacterEvent[],
  requestedCharacterId = ''
): CharacterHistoryView {
  const characterId = events[0]?.characterId ?? requestedCharacterId
  return {
    characterId,
    entries: events.map((event) => ({
      eventId: event.eventId,
      occurredAt: event.occurredAt,
      actorId: event.actorId,
      eventType: event.type,
      summary: summarise(event)
    }))
  }
}
