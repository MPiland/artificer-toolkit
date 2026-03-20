import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const zombie: CreatureAuthored = {
  id: CREATURE_IDS.ZOMBIE,
  label: 'Zombie',
  description: 'A shambling undead creature driven by an insatiable hunger.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'MONSTER',
  creatureTypeId: CREATURE_TYPE.UNDEAD,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 13,
    DEXTERITY: 6,
    CONSTITUTION: 16,
    INTELLIGENCE: 3,
    WISDOM: 6,
    CHARISMA: 5,
    SPELLCASTING: 0
  },
  armorClass: 8,
  hitPoints: 22,
  hitDice: '3d8+9',
  speeds: walk(20),
  damageImmunities: ['poison'],
  conditionImmunities: ['poisoned'],
  challengeRatingId: CR.CR_1_4,
  xp: 50
}
