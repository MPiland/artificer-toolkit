import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const cultFanatic: CreatureAuthored = {
  id: CREATURE_IDS.CULT_FANATIC,
  label: 'Cult Fanatic',
  description: 'A devoted zealot who serves a dark deity or fiendish patron with fanatical loyalty.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 14,
    CONSTITUTION: 12,
    INTELLIGENCE: 10,
    WISDOM: 13,
    CHARISMA: 14,
    SPELLCASTING: 13
  },
  armorClass: 13,
  armorClassNote: 'leather armor',
  hitPoints: 33,
  hitDice: '6d8+6',
  speeds: walk(30),
  challengeRatingId: CR.CR_2,
  xp: 450
}
