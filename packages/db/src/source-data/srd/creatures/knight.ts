import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const knight: CreatureAuthored = {
  id: CREATURE_IDS.KNIGHT,
  label: 'Knight',
  description: 'A heavily armored warrior sworn to a lord or cause, trained in the finest martial traditions.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  recordKind: 'STAT_BLOCK',
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 11,
    CONSTITUTION: 14,
    INTELLIGENCE: 11,
    WISDOM: 11,
    CHARISMA: 15,
    SPELLCASTING: 0
  },
  armorClass: 18,
  armorClassNote: 'plate armor',
  hitPoints: 52,
  hitDice: '8d8+16',
  speeds: walk(30),
  challengeRatingId: CR.CR_3,
  xp: 700
}

