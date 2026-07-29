import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const banditCaptain: CreatureAuthored = {
  id: CREATURE_IDS.BANDIT_CAPTAIN,
  label: 'Bandit Captain',
  description:
    'A cunning and ruthless leader who commands a gang of outlaws through fear and gold.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 16,
    CONSTITUTION: 14,
    INTELLIGENCE: 14,
    WISDOM: 11,
    CHARISMA: 14
  },
  armorClass: 15,
  armorClassNote: 'studded leather armor',
  hitPoints: 65,
  hitDice: {
    count: 10,
    die: 8,
    modifier: 20
  },
  speeds: walk(30),
  challengeRatingId: CR.CR_2,
  xp: 450
}
