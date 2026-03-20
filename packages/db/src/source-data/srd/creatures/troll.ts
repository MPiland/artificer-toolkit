import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const troll: CreatureAuthored = {
  id: CREATURE_IDS.TROLL,
  label: 'Troll',
  description: 'A large, brutish giant with fearsome regenerative abilities that make it nearly impossible to kill without fire or acid.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'MONSTER',
  creatureTypeId: CREATURE_TYPE.GIANT,
  size: 'LARGE',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 13,
    CONSTITUTION: 20,
    INTELLIGENCE: 7,
    WISDOM: 9,
    CHARISMA: 7,
    SPELLCASTING: 0
  },
  armorClass: 15,
  armorClassNote: 'natural armor',
  hitPoints: 84,
  hitDice: '8d10+40',
  speeds: walk(30),
  challengeRatingId: CR.CR_5,
  xp: 1800
}
