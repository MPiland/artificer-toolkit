import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const cultist: CreatureAuthored = {
  id: CREATURE_IDS.CULTIST,
  label: 'Cultist',
  description: 'A misguided soul who has pledged themselves to a sinister cult in search of power or meaning.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 11,
    DEXTERITY: 12,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 11,
    CHARISMA: 10,
    SPELLCASTING: 0
  },
  armorClass: 12,
  armorClassNote: 'leather armor',
  hitPoints: 9,
  hitDice: '2d8',
  speeds: walk(30),
  challengeRatingId: CR.CR_1_8,
  xp: 25
}
