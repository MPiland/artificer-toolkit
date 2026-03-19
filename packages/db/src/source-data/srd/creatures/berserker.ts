import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const berserker: CreatureAuthored = {
  id: CREATURE_IDS.BERSERKER,
  label: 'Berserker',
  description: 'A fierce warrior who enters a battle rage that makes them nearly unstoppable.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 12,
    CONSTITUTION: 17,
    INTELLIGENCE: 9,
    WISDOM: 11,
    CHARISMA: 9,
    SPELLCASTING: 0
  },
  armorClass: 13,
  armorClassNote: 'hide armor',
  hitPoints: 67,
  hitDice: '9d8+27',
  speeds: walk(30),
  challengeRatingId: CR.CR_2,
  xp: 450
}
