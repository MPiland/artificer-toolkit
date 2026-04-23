import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const seaHorse: CreatureAuthored = {
  id: S.CREATURE_IDS.SEA_HORSE,
  label: 'Sea Horse',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 1,
    DEXTERITY: 12,
    CONSTITUTION: 8,
    INTELLIGENCE: 1,
    WISDOM: 10,
    CHARISMA: 2,
    SPELLCASTING: 0
  },
  armorClass: 11,
  hitPoints: 1,
  hitDice: '1d4 - 1',
  speeds: [...S.walk(0), ...S.swim(20)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_0,
  xp: 0,
  features: [
    {
      id: S.featureId(249, 1),
      label: 'Water Breathing',
      description: 'Water Breathing. The sea horse can breathe only underwater.',
      order: 1
    }
  ]
}

