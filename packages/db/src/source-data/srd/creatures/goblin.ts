import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const goblin: CreatureAuthored = {
  id: CREATURE_IDS.GOBLIN,
  label: 'Goblin',
  description: 'A small, black-hearted humanoid that dwells in dark dungeons and foul forests.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'MONSTER',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'SMALL',
  abilityScores: {
    STRENGTH: 8,
    DEXTERITY: 14,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 8,
    CHARISMA: 8
  },
  armorClass: 15,
  armorClassNote: 'leather armor, shield',
  hitPoints: 7,
  hitDice: {
    count: 2,
    die: 6,
    modifier: 0
  },
  speeds: walk(30),
  challengeRatingId: CR.CR_1_4,
  xp: 50
}
