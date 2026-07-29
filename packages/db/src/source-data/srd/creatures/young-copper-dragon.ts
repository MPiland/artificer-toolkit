import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const youngCopperDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.YOUNG_COPPER_DRAGON,
  label: 'Young Copper Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000300000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 12,
    CONSTITUTION: 17,
    INTELLIGENCE: 16,
    WISDOM: 13,
    CHARISMA: 15
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 119,
  hitDice: {
    count: 14,
    die: 10,
    modifier: 42
  },
  speeds: [...S.walk(40), ...S.climb(40), ...S.fly(80)],
  proficiencies: [S.grantedSkillProficiency(4834, 1, 'DECEPTION', 'PERCEPTION', 'STEALTH')],
  damageImmunities: ['acid'],
  senses: ['blindsight 30 ft.', 'darkvision 120 ft.'],
  passivePerception: 19,
  challengeRatingId: S.CR.CR_7,
  xp: 2900,
  features: [
    {
      id: S.featureId(305, 1),
      label: 'Spider Climb',
      description:
        'Spider Climb. The dragon can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
      order: 1
    },
    {
      id: S.featureId(305, 2),
      label: 'Acid Breath',
      description:
        'Acid Breath. The dragon exhales acid in a line. Each creature in the line must make a Dexterity saving throw, taking acid damage on a failed save, or half as much damage on a successful one.',
      order: 2
    },
    {
      id: S.featureId(305, 3),
      label: 'Multiattack',
      description:
        'Multiattack. The dragon makes three attacks: one with its bite and two with its claws.',
      order: 3
    },
    {
      id: S.featureId(305, 4),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +7 to hit, reach 10 ft., one target. Hit: 15 (2d10 + 4) piercing damage plus acid damage.',
      order: 4
    },
    {
      id: S.featureId(305, 5),
      label: 'Claw',
      description:
        'Claw. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing damage.',
      order: 5
    }
  ]
}
