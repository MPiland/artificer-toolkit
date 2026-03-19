import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const veteran: CreatureAuthored = {
  id: CREATURE_IDS.VETERAN,
  label: 'Veteran',
  description: 'A seasoned fighter with years of battlefield experience and a mastery of multiple weapons.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 13,
    CONSTITUTION: 14,
    INTELLIGENCE: 10,
    WISDOM: 11,
    CHARISMA: 10,
    SPELLCASTING: 0
  },
  armorClass: 17,
  armorClassNote: 'splint armor',
  hitPoints: 58,
  hitDice: '9d8+18',
  speeds: walk(30),
  challengeRatingId: CR.CR_3,
  xp: 700
}
