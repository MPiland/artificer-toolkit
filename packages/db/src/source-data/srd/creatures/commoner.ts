import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const commoner: CreatureAuthored = {
  id: CREATURE_IDS.COMMONER,
  label: 'Commoner',
  description: 'An ordinary person with no special training or abilities.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 10,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 10,
    SPELLCASTING: 0
  },
  armorClass: 10,
  hitPoints: 4,
  hitDice: '1d8',
  speeds: walk(30),
  challengeRatingId: CR.CR_0,
  xp: 10
}
