import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const wolf: CreatureAuthored = {
  id: CREATURE_IDS.WOLF,
  label: 'Wolf',
  description: 'A pack predator that uses superior numbers to bring down prey.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'BEAST',
  creatureTypeId: CREATURE_TYPE.BEAST,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 12,
    DEXTERITY: 15,
    CONSTITUTION: 12,
    INTELLIGENCE: 3,
    WISDOM: 12,
    CHARISMA: 6,
    SPELLCASTING: 0
  },
  armorClass: 13,
  armorClassNote: 'natural armor',
  hitPoints: 11,
  hitDice: '2d8+2',
  speeds: walk(40),
  challengeRatingId: CR.CR_1_4,
  xp: 50
}
