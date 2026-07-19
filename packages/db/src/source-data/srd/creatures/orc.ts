import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const orc: CreatureAuthored = {
  id: CREATURE_IDS.ORC,
  label: 'Orc',
  description: 'A savage, brutish humanoid that revels in combat and destruction.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'MONSTER',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 12,
    CONSTITUTION: 16,
    INTELLIGENCE: 7,
    WISDOM: 11,
    CHARISMA: 10,
  },
  armorClass: 13,
  armorClassNote: 'hide armor',
  hitPoints: 15,
  hitDice: '2d8+6',
  speeds: walk(30),
  challengeRatingId: CR.CR_1_2,
  xp: 100
}

