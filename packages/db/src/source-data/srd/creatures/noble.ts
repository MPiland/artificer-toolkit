import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const noble: CreatureAuthored = {
  id: CREATURE_IDS.NOBLE,
  label: 'Noble',
  description: 'A person of wealth and standing who wields political influence and expects deference.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 11,
    DEXTERITY: 12,
    CONSTITUTION: 11,
    INTELLIGENCE: 12,
    WISDOM: 14,
    CHARISMA: 16,
    SPELLCASTING: 0
  },
  armorClass: 15,
  armorClassNote: 'breastplate',
  hitPoints: 9,
  hitDice: '2d8',
  speeds: walk(30),
  challengeRatingId: CR.CR_1_8,
  xp: 25
}

