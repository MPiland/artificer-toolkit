import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const youngBronzeDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.YOUNG_BRONZE_DRAGON,
  label: 'Young Bronze Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 21,
    DEXTERITY: 10,
    CONSTITUTION: 19,
    INTELLIGENCE: 14,
    WISDOM: 13,
    CHARISMA: 17,
  },
  armorClass: 18,
  armorClassNote: 'natural armor',
  hitPoints: 142,
  hitDice: {
    count: 15,
    die: 10,
    modifier: 60,
  },
  speeds: [...S.walk(40), ...S.fly(80), ...S.swim(40)],
  proficiencies: [
    S.grantedSaveProficiency(304, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(304, 2, 'INSIGHT', 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(304, 3, 'COMMON', 'DRACONIC')
  ],
  damageImmunities: ['lightning'],
  senses: ['blindsight 30 ft.', 'darkvision 120 ft.'],
  passivePerception: 17,
  challengeRatingId: S.CR.CR_8,
  xp: 3900,
  features: [
    {
      id: S.featureId(304, 1),
      label: 'Amphibious',
      description: 'Amphibious. The dragon can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(304, 2),
      label: 'Multiattack',
      description: 'The dragon makes three attacks: one with its bite and two with its claws.',
      order: 2
    },
    {
      id: S.featureId(304, 3),
      label: 'Bite',
      description: 'Melee Weapon Attack: +8 to hit, reach 10 ft., one target. Hit: 16 (2d10 + 5) piercing damage.',
      order: 3
    },
    {
      id: S.featureId(304, 4),
      label: 'Claw',
      description: 'Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 12 (2d6 + 5) slashing damage.',
      order: 4
    },
    {
      id: S.featureId(304, 5),
      label: 'Lightning Breath (Recharge 5-6)',
      description: 'The dragon exhales lightning in a 60-foot line that is 5 feet wide. Each creature in that line must make a DC 15 Dexterity saving throw, taking 55 (10d10) lightning damage on a failed save, or half as much damage on a successful one.',
      order: 5
    },
    {
      id: S.featureId(304, 6),
      label: 'Repulsion Breath (Recharge 5-6)',
      description: 'The dragon exhales repulsion energy in a 30-foot cone. Each creature in that area must succeed on a DC 15 Strength saving throw. On a failed save, the creature is pushed 40 feet away from the dragon.',
      order: 6
    }
  ]
}

