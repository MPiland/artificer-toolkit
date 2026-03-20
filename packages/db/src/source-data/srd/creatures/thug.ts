import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const thug: CreatureAuthored = {
  id: CREATURE_IDS.THUG,
  label: 'Thug',
  description: 'A brutal enforcer who relies on raw strength and pack tactics to overwhelm foes.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 11,
    CONSTITUTION: 14,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 11,
    SPELLCASTING: 0
  },
  armorClass: 11,
  armorClassNote: 'leather armor',
  hitPoints: 32,
  hitDice: '5d8+10',
  speeds: walk(30),
  challengeRatingId: CR.CR_1_2,
  xp: 100
}
