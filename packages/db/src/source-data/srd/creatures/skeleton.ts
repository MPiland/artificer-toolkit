import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const skeleton: CreatureAuthored = {
  id: CREATURE_IDS.SKELETON,
  label: 'Skeleton',
  description: 'An animated skeleton raised from the dead by necromantic magic.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'MONSTER',
  creatureTypeId: CREATURE_TYPE.UNDEAD,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 14,
    CONSTITUTION: 15,
    INTELLIGENCE: 6,
    WISDOM: 8,
    CHARISMA: 5,
    SPELLCASTING: 0
  },
  armorClass: 13,
  armorClassNote: 'armor scraps',
  hitPoints: 13,
  hitDice: '2d8+4',
  speeds: walk(30),
  damageVulnerabilities: ['bludgeoning'],
  damageImmunities: ['poison'],
  conditionImmunities: ['exhaustion', 'poisoned'],
  challengeRatingId: CR.CR_1_4,
  xp: 50
}
