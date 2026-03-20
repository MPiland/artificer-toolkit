import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const giantSpider: CreatureAuthored = {
  id: CREATURE_IDS.GIANT_SPIDER,
  label: 'Giant Spider',
  description: 'A massive arachnid that spins webs to trap prey, then injects venom with its bite.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'BEAST',
  creatureTypeId: CREATURE_TYPE.BEAST,
  size: 'LARGE',
  abilityScores: {
    STRENGTH: 14,
    DEXTERITY: 16,
    CONSTITUTION: 12,
    INTELLIGENCE: 2,
    WISDOM: 11,
    CHARISMA: 4,
    SPELLCASTING: 0
  },
  armorClass: 14,
  armorClassNote: 'natural armor',
  hitPoints: 26,
  hitDice: '4d10+4',
  speeds: walk(30),
  challengeRatingId: CR.CR_1,
  xp: 200
}
