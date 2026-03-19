import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const ghoul: CreatureAuthored = {
  id: CREATURE_IDS.GHOUL,
  label: 'Ghoul',
  description: 'A foul undead creature that feasts on corpses and paralyzes the living with its claws.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'MONSTER',
  creatureTypeId: CREATURE_TYPE.UNDEAD,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 13,
    DEXTERITY: 15,
    CONSTITUTION: 10,
    INTELLIGENCE: 7,
    WISDOM: 10,
    CHARISMA: 6,
    SPELLCASTING: 0
  },
  armorClass: 12,
  hitPoints: 22,
  hitDice: '5d8',
  speeds: walk(30),
  damageImmunities: ['poison'],
  conditionImmunities: ['charmed', 'exhaustion', 'poisoned'],
  challengeRatingId: CR.CR_1,
  xp: 200
}
