import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const androsphinx: CreatureAuthored = {
  id: S.CREATURE_IDS.ANDROSPHINX,
  label: 'Androsphinx',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000400000000',
  abilityScores: {
    STRENGTH: 22,
    DEXTERITY: 10,
    CONSTITUTION: 20,
    INTELLIGENCE: 16,
    WISDOM: 18,
    CHARISMA: 23,
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 199,
  hitDice: '19d10+95',
  speeds: [...S.walk(40), ...S.fly(60)],
  proficiencies: [
    S.grantedSaveProficiency(24, 1, 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(24, 2, 'ARCANA', 'PERCEPTION', 'RELIGION'),
    S.grantedLanguageProficiency(24, 3, 'COMMON', 'SPHINX')
  ],
  damageResistances: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['psychic'],
  conditionImmunities: ['charmed', 'frightened'],
  senses: ['truesight 120 ft.'],
  passivePerception: 20,
  challengeRatingId: S.CR.CR_17,
  xp: 18000,
  features: [
    {
      id: S.featureId(24, 1),
      label: 'Inscrutable',
      description: "Inscrutable. The sphinx is immune to any effect that would sense its emotions or read its thoughts, as well as any divination spell that it refuses. Wisdom (Insight) checks made to ascertain the sphinx's intentions or sincerity have disadvantage.",
      order: 1
    },
    {
      id: S.featureId(24, 2),
      label: 'Magic Weapons',
      description: "Magic Weapons. The sphinx's weapon attacks are magical.",
      order: 2
    },
    {
      id: S.featureId(24, 3),
      label: 'Multiattack',
      description: 'Multiattack. The sphinx makes two claw attacks.',
      order: 3
    },
    {
      id: S.featureId(24, 4),
      label: 'Claw',
      description: 'Claw. Melee Weapon Attack: +12 to hit, reach 5 ft., one target. Hit: 17 (2d10 + 6) slashing damage.',
      order: 4
    },
    {
      id: S.featureId(24, 5),
      label: 'Roar (3/Day)',
      description: "Roar (3/Day). The sphinx emits a magical roar. The first roar causes each creature within 500 feet that can hear it to make a Wisdom saving throw or become frightened for 1 minute. The second roar can deafen and frighten creatures. The third roar deals thunder damage and can stun creatures that fail the save. A creature can repeat the save at the end of each of its turns when applicable.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(24, 30),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 5
    },
    {
      id: S.featureId(24, 6),
      label: 'Legendary Actions',
      section: 'LEGENDARY_ACTION',
      description: "Legendary Actions. The sphinx can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The sphinx regains spent legendary actions at the start of its turn. Detect. The sphinx makes a Wisdom (Perception) check. Claw Attack. The sphinx makes one claw attack. Teleport (Costs 2 Actions). The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.",
      order: 6
    }
  ]
}

