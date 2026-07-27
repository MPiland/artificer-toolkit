import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const polarBear: CreatureAuthored = {
  id: S.CREATURE_IDS.POLAR_BEAR,
  label: 'Polar Bear',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 20,
    DEXTERITY: 10,
    CONSTITUTION: 16,
    INTELLIGENCE: 2,
    WISDOM: 13,
    CHARISMA: 7
  },
  armorClass: 12,
  armorClassNote: 'natural armor',
  hitPoints: 42,
  hitDice: {
    count: 5,
    die: 10,
    modifier: 15
  },
  speeds: [...S.walk(40), ...S.swim(30)],
  proficiencies: [S.grantedSkillProficiency(223, 1, 'PERCEPTION')],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(223, 1),
      label: 'Keen Smell',
      description:
        'Keen Smell. The bear has advantage on Wisdom (Perception) checks that rely on smell.',
      order: 1
    },
    {
      id: S.featureId(223, 2),
      label: 'Multiattack',
      description:
        'Multiattack. The bear makes two attacks: one with its bite and one with its claws.',
      order: 2
    },
    {
      id: S.featureId(223, 3),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 9 (1d8 + 5) piercing damage.',
      order: 3
    },
    {
      id: S.featureId(223, 4),
      label: 'Claws',
      description:
        'Claws. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 12 (2d6 + 5) slashing damage.',
      order: 4
    }
  ]
}
