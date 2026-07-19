import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const ape: CreatureAuthored = {
  id: S.CREATURE_IDS.APE,
  label: 'Ape',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 14,
    CONSTITUTION: 14,
    INTELLIGENCE: 6,
    WISDOM: 12,
    CHARISMA: 7,
  },
  armorClass: 12,
  hitPoints: 19,
  hitDice: '3d8+6',
  speeds: [...S.walk(30), ...S.climb(30)],
  proficiencies: [
    S.grantedSkillProficiency(27, 1, 'ATHLETICS', 'PERCEPTION')
  ],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(27, 1),
      label: 'Multiattack',
      description: 'Multiattack. The ape makes two fist attacks.',
      order: 1
    },
    {
      id: S.featureId(27, 2),
      label: 'Fist',
      description: 'Fist. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) bludgeoning damage.',
      order: 2
    },
    {
      id: S.featureId(27, 3),
      label: 'Rock',
      description: 'Rock. Ranged Weapon Attack: +5 to hit, range 25/50 ft., one target. Hit: 6 (1d6 + 3) bludgeoning damage.',
      order: 3
    }
  ]
}

