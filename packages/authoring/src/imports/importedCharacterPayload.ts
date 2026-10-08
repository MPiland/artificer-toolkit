import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import type { ExternalContentReference, ParsedExternalCharacter } from './importParsers.js'

interface ImportedCharacterReference extends ExternalContentReference {
  subjectId?: string
}

interface ImportedCharacterPayloadInput {
  targetId: string
  label: string
  parsed: ParsedExternalCharacter
  references: readonly ImportedCharacterReference[]
}

export function buildImportedCharacter(
  item: ImportedCharacterPayloadInput,
  userId: string,
  systemId: string,
  primaryRulesCatalogueId: string,
  createId: () => string
): CharacterAuthored {
  const character = createEmptyCharacterAuthored({
    id: item.targetId,
    primaryRulesCatalogueId,
    systemId,
    userId
  })
  character.label = item.label
  character.description = item.parsed.description
  character.profile = item.parsed.profile
  if (item.parsed.abilities) {
    character.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        assignments: Object.entries(item.parsed.abilities).map(([ability, score]) => ({
          ability: ability as keyof typeof item.parsed.abilities,
          score
        }))
      }
    }
  }
  if (item.parsed.hitPoints) {
    character.state.hitpoints.current = item.parsed.hitPoints.current
    character.state.hitpoints.temp = item.parsed.hitPoints.temp
  }

  let lastClassIndex = -1
  for (const reference of item.references) {
    if (!reference.subjectId) continue
    if (reference.role === 'RACE') character.intent.race.raceId = reference.subjectId
    else if (reference.role === 'BACKGROUND')
      character.intent.background.backgroundId = reference.subjectId
    else if (reference.role === 'CLASS') {
      character.intent.classes.push({
        classId: reference.subjectId,
        classLevel: reference.level ?? 1
      })
      lastClassIndex = character.intent.classes.length - 1
    } else if (reference.role === 'SUBCLASS' && lastClassIndex >= 0) {
      character.intent.classes[lastClassIndex]!.subclassId = reference.subjectId
    } else if (reference.role === 'EQUIPMENT') {
      const itemId = createId()
      character.state.equipment.inventory.push({
        id: itemId,
        equipmentId: reference.subjectId,
        quantity: reference.quantity ?? 1
      })
      if (reference.equipped) character.state.equipment.equipped.push(itemId)
      if (reference.attuned) character.state.equipment.attuned.push(itemId)
    }
  }

  return character
}
