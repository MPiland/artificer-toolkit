import { CharacterStartingEquipmentSource } from '@artificer-toolkit/shared/subjects/authored'
import type {
  CharacterFormValues,
  CharacterStartingEquipmentDecision
} from '../../core/characterBuilder.types'

export function createStartingEquipmentDecision(
  source: 'CLASS' | 'BACKGROUND'
): CharacterStartingEquipmentDecision {
  return {
    source:
      source === 'CLASS'
        ? CharacterStartingEquipmentSource.CLASS
        : CharacterStartingEquipmentSource.BACKGROUND,
    tookGold: false,
    groups: []
  }
}

export function omitEmptyStartingEquipment(
  startingEquipment: CharacterFormValues['intent']['startingEquipment']
): CharacterFormValues['intent']['startingEquipment'] {
  return startingEquipment?.class || startingEquipment?.background ? startingEquipment : undefined
}
