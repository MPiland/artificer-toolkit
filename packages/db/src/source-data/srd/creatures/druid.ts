import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'

export const druid: CreatureAuthored = {
  id: CREATURE_IDS.DRUID,
  label: 'Druid',
  description: 'A spellcaster who draws power from the natural world and shapeshifts to defend the wild places.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 12,
    CONSTITUTION: 13,
    INTELLIGENCE: 12,
    WISDOM: 15,
    CHARISMA: 11,
  },
  armorClass: 11,
  armorClassNote: 'leather armor',
  hitPoints: 27,
  hitDice: '5d8+5',
  speeds: walk(30),
  challengeRatingId: CR.CR_2,
  xp: 450
}

