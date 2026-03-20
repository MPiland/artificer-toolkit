import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const mage: CreatureAuthored = {
  id: CREATURE_IDS.MAGE,
  label: 'Mage',
  description: 'A powerful arcane spellcaster who has devoted years to mastering the mysteries of magic.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 9,
    DEXTERITY: 14,
    CONSTITUTION: 11,
    INTELLIGENCE: 17,
    WISDOM: 12,
    CHARISMA: 11,
    SPELLCASTING: 15
  },
  armorClass: 12,
  armorClassNote: '15 with mage armor',
  hitPoints: 40,
  hitDice: '9d8',
  speeds: walk(30),
  challengeRatingId: CR.CR_6,
  xp: 2300
}
