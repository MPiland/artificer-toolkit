import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const guard: CreatureAuthored = {
  id: CREATURE_IDS.GUARD,
  label: 'Guard',
  description: 'A trained warrior that watches over a location or person.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 13,
    DEXTERITY: 12,
    CONSTITUTION: 12,
    INTELLIGENCE: 10,
    WISDOM: 11,
    CHARISMA: 10,
    SPELLCASTING: 0
  },
  armorClass: 16,
  armorClassNote: 'chain shirt, shield',
  hitPoints: 11,
  hitDice: '2d8+2',
  speeds: walk(30),
  challengeRatingId: CR.CR_1_8,
  xp: 25
}
