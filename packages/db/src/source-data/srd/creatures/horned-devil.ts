import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const hornedDevil: CreatureAuthored = {
  id: S.CREATURE_IDS.HORNED_DEVIL,
  label: 'Horned Devil',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['devil'],
  abilityScores: {
    STRENGTH: 22,
    DEXTERITY: 17,
    CONSTITUTION: 21,
    INTELLIGENCE: 12,
    WISDOM: 16,
    CHARISMA: 17,
  },
  armorClass: 18,
  armorClassNote: 'natural armor',
  hitPoints: 178,
  hitDice: {
    count: 17,
    die: 10,
    modifier: 85,
  },
  speeds: [...S.walk(20), ...S.fly(60)],
  proficiencies: [
    S.grantedSaveProficiency(9677, 1, 'STRENGTH', 'DEXTERITY', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(9677, 2, 'INFERNAL')
  ],
  damageResistances: ["cold; bludgeoning, piercing, and slashing from nonmagical attacks not made with silvered weapons"],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: ['darkvision 120 ft.'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_11,
  xp: 7200,
  features: [
    {
      id: S.featureId(167, 1),
      label: "Devil's Sight",
      description: "Devil's Sight. Magical darkness doesn't impede the devil's darkvision.",
      order: 1
    },
    {
      id: S.featureId(167, 2),
      label: 'Magic Resistance',
      description: 'Magic Resistance. The devil has advantage on saving throws against spells and other magical effects.',
      order: 2
    },
    {
      id: S.featureId(167, 3),
      label: 'Multiattack',
      description: 'Multiattack. The devil makes three melee attacks: two with its fork and one with its tail. It can use Hurl Flame in place of any melee attack.',
      order: 3
    },
    {
      id: S.featureId(167, 4),
      label: 'Fork',
      description: 'Fork. Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 15 (2d8 + 6) piercing damage.',
      order: 4
    },
    {
      id: S.featureId(167, 5),
      label: 'Tail',
      description: 'Tail. Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 10 (1d8 + 6) piercing damage. If the target is a creature other than an undead or a construct, it must succeed on a DC 17 Constitution saving throw or lose 10 (3d6) hit points at the start of each of its turns due to an infernal wound. Each time the devil hits the wounded target with this attack, the damage dealt by the wound increases by 10 (3d6). Any creature can take an action to stanch the wound with a successful DC 12 Wisdom (Medicine) check. The wound also closes if the target receives magical healing.',
      order: 5
    },
    {
      id: S.featureId(167, 6),
      label: 'Hurl Flame',
      description: 'Hurl Flame. Ranged Spell Attack: +7 to hit, range 150 ft., one target. Hit: 14 (4d6) fire damage. If the target is a flammable object that is not being worn or carried, it also catches fire.',
      order: 6
    }
  ]
}

