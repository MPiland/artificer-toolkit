import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const goldDragonWyrmling: CreatureAuthored = {
  id: S.CREATURE_IDS.GOLD_DRAGON_WYRMLING,
  label: 'Gold Dragon Wyrmling',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 14,
    CONSTITUTION: 17,
    INTELLIGENCE: 14,
    WISDOM: 11,
    CHARISMA: 16,
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 60,
  hitDice: {
    count: 8,
    die: 8,
    modifier: 24,
  },
  speeds: [...S.walk(30), ...S.fly(60), ...S.swim(30)],
  proficiencies: [
    S.grantedSaveProficiency(3328, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(3328, 2, 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(3328, 3, 'DRACONIC')
  ],
  damageImmunities: ['fire'],
  senses: ['blindsight 10 ft.', 'darkvision 60 ft.'],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(147, 1),
      label: 'Amphibious',
      description: 'Amphibious. The dragon can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(147, 2),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 9 (1d10 + 4) piercing damage.',
      order: 2
    },
    {
      id: S.featureId(147, 3),
      label: 'Breath Weapons (Recharge 5-6)',
      description: 'Breath Weapons (Recharge 5-6). The dragon uses one of the following breath weapons. Fire Breath. The dragon exhales fire in a 15-foot cone. Each creature in that area must make a DC 13 Dexterity saving throw, taking 22 (4d10) fire damage on a failed save, or half as much damage on a successful one. Weakening Breath. The dragon exhales gas in a 15-foot cone. Each creature in that area must succeed on a DC 13 Strength saving throw or have disadvantage on Strength-based attack rolls, Strength checks, and Strength saving throws for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      order: 3
    }
  ]
}

