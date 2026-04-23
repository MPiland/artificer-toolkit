import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const giantEagle: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_EAGLE,
  label: 'Giant Eagle',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000200000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 17,
    CONSTITUTION: 13,
    INTELLIGENCE: 8,
    WISDOM: 14,
    CHARISMA: 10,
    SPELLCASTING: 0
  },
  armorClass: 13,
  hitPoints: 26,
  hitDice: '4d10+4',
  speeds: [...S.walk(10), ...S.fly(80)],
  proficiencies: [
    S.grantedSkillProficiency(121, 1, 'PERCEPTION'),
    S.grantedLanguageProficiency(121, 2, 'GIANT_EAGLE')
  ],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(121, 1),
      label: 'Keen Sight',
      description: 'Keen Sight. The eagle has advantage on Wisdom (Perception) checks that rely on sight.',
      order: 1
    },
    {
      id: S.featureId(121, 2),
      label: 'Language Limitation',
      description: 'Understands Common and Auran but can\'t speak them.',
      grants: {
        proficiencies: [
          S.grantedLanguageProficiency(121, 3, 'COMMON', 'AURAN')
        ]
      },
      order: 2
    },
    {
      id: S.featureId(121, 3),
      label: 'Multiattack',
      description: 'Multiattack. The eagle makes two attacks: one with its beak and one with its talons.',
      order: 3
    },
    {
      id: S.featureId(121, 4),
      label: 'Beak',
      description: 'Beak. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) piercing damage.',
      order: 4
    },
    {
      id: S.featureId(121, 5),
      label: 'Talons',
      description: 'Talons. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage.',
      order: 5
    }
  ]
}

