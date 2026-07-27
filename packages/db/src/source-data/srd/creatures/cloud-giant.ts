import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const cloudGiant: CreatureAuthored = {
  id: S.CREATURE_IDS.CLOUD_GIANT,
  label: 'Cloud Giant',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.GIANT,
  size: S.SIZE_CODE.HUGE,
  abilityScores: {
    STRENGTH: 27,
    DEXTERITY: 10,
    CONSTITUTION: 22,
    INTELLIGENCE: 12,
    WISDOM: 16,
    CHARISMA: 16
  },
  armorClass: 14,
  armorClassNote: 'natural armor',
  hitPoints: 200,
  hitDice: {
    count: 16,
    die: 12,
    modifier: 96
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSaveProficiency(66, 1, 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(66, 2, 'INSIGHT', 'PERCEPTION'),
    S.grantedLanguageProficiency(66, 3, 'COMMON', 'GIANT')
  ],
  passivePerception: 17,
  challengeRatingId: S.CR.CR_9,
  xp: 5000,
  features: [
    {
      id: S.featureId(66, 1),
      label: 'Keen Smell',
      description:
        'Keen Smell. The giant has advantage on Wisdom (Perception) checks that rely on smell.',
      order: 1
    },
    {
      id: S.featureId(66, 2),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The giant's innate spellcasting ability is Charisma. It can innately cast the following spells, requiring no material components: At will: detect magic, fog cloud, light. 3/day each: feather fall, fly, misty step, telekinesis. 1/day each: control weather, gaseous form.",
      order: 2
    },
    {
      id: S.featureId(66, 3),
      label: 'Multiattack',
      description: 'The giant makes two morningstar attacks.',
      order: 3
    },
    {
      id: S.featureId(66, 4),
      label: 'Morningstar',
      description:
        'Melee Weapon Attack: +12 to hit, reach 10 ft., one target. Hit: 21 (3d8 + 8) piercing damage.',
      order: 4
    },
    {
      id: S.featureId(66, 5),
      label: 'Rock',
      description:
        'Ranged Weapon Attack: +12 to hit, range 60/240 ft., one target. Hit: 30 (4d10 + 8) bludgeoning damage.',
      order: 5
    }
  ]
}
