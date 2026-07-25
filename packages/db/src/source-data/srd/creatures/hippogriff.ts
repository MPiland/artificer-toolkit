import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const hippogriff: CreatureAuthored = {
  id: S.CREATURE_IDS.HIPPOGRIFF,
  label: 'Hippogriff',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 13,
    CONSTITUTION: 13,
    INTELLIGENCE: 2,
    WISDOM: 12,
    CHARISMA: 8,
  },
  armorClass: 11,
  hitPoints: 19,
  hitDice: {
    count: 3,
    die: 10,
    modifier: 3,
  },
  speeds: [...S.walk(40), ...S.fly(60)],
  proficiencies: [
    S.grantedSkillProficiency(164, 1, 'PERCEPTION')
  ],
  passivePerception: 15,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(164, 1),
      label: 'Keen Sight',
      description: 'Keen Sight. The hippogriff has advantage on Wisdom (Perception) checks that rely on sight.',
      order: 1
    },
    {
      id: S.featureId(164, 2),
      label: 'Multiattack',
      description: 'The hippogriff makes two attacks: one with its beak and one with its claws.',
      order: 2
    },
    {
      id: S.featureId(164, 3),
      label: 'Beak',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (1d10 + 3) piercing damage.',
      order: 3
    },
    {
      id: S.featureId(164, 4),
      label: 'Claws',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage.',
      order: 4
    }
  ]
}

