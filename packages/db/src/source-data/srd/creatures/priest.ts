import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const priest: CreatureAuthored = {
  id: CREATURE_IDS.PRIEST,
  label: 'Priest',
  description: 'A devout servant of a deity who channels divine magic to heal allies and smite enemies.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 10,
    CONSTITUTION: 12,
    INTELLIGENCE: 13,
    WISDOM: 16,
    CHARISMA: 13,
  },
  armorClass: 13,
  armorClassNote: 'chain shirt',
  hitPoints: 27,
  hitDice: {
    count: 5,
    die: 8,
    modifier: 5,
  },
  speeds: walk(30),
  challengeRatingId: CR.CR_2,
  xp: 450
}

