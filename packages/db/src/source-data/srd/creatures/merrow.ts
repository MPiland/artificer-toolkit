import type { CreatureAuthored } from '@artificer-toolkit/shared'

import * as S from './shared.js'

export const merrow: CreatureAuthored = {
  id: S.CREATURE_IDS.MERROW,
  label: 'Merrow',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 10,
    CONSTITUTION: 15,
    INTELLIGENCE: 8,
    WISDOM: 10,
    CHARISMA: 9,
  },
  armorClass: 13,
  armorClassNote: 'natural armor',
  hitPoints: 45,
  hitDice: {
    count: 6,
    die: 10,
    modifier: 12,
  },
  speeds: [...S.walk(10), ...S.swim(40)],
  proficiencies: [
    S.grantedLanguageProficiency(196, 1, 'ABYSSAL', 'AQUAN')
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(196, 1),
      label: 'Amphibious',
      description: 'Amphibious. The merrow can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(196, 2),
      label: 'Multiattack',
      description: 'Multiattack. The merrow makes two attacks: one with its bite and one with its claws or harpoon.',
      order: 2
    },
    {
      id: S.featureId(196, 3),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) piercing damage.',
      order: 3
    },
    {
      id: S.featureId(196, 4),
      label: 'Claws',
      description: 'Claws. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 9 (2d4 + 4) slashing damage.',
      order: 4
    },
    {
      id: S.featureId(196, 5),
      label: 'Harpoon',
      description: 'Harpoon. Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 11 (2d6 + 4) piercing damage. If the target is a Large or smaller creature, it is grappled (escape DC 14). The merrow has two harpoons, each of which can grapple only one target.',
      order: 5
    }
  ]
}

