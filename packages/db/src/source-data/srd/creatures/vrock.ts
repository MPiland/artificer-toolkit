import { type CreatureAuthored } from '@artificer-toolkit/shared'

import * as S from './shared.js'

export const vrock: CreatureAuthored = {
  id: S.CREATURE_IDS.VROCK,
  label: 'Vrock',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['demon'],
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 15,
    CONSTITUTION: 18,
    INTELLIGENCE: 8,
    WISDOM: 13,
    CHARISMA: 8
  },
  armorClass: 15,
  armorClassNote: 'natural armor',
  hitPoints: 104,
  hitDice: {
    count: 11,
    die: 10,
    modifier: 44
  },
  speeds: [...S.walk(40), ...S.fly(60)],
  proficiencies: [
    S.grantedSaveProficiency(281, 1, 'DEXTERITY', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(281, 2, 'ABYSSAL')
  ],
  damageResistances: [
    'cold, fire, lightning; bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  damageImmunities: ['poison'],
  conditionImmunities: ['poisoned'],
  senses: ['darkvision 120 ft.'],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_6,
  xp: 2300,
  features: [
    {
      id: S.featureId(281, 1),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The vrock has advantage on saving throws against spells and other magical effects.',
      order: 1
    },
    {
      id: S.featureId(281, 2),
      label: 'Telepathy',
      description: 'Telepathy 120 ft.',
      order: 2
    },
    {
      id: S.featureId(281, 3),
      label: 'Multiattack',
      description: 'The vrock makes two attacks: one with its beak and one with its talons.',
      order: 3
    },
    {
      id: S.featureId(281, 4),
      label: 'Beak',
      description:
        'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) piercing damage.',
      order: 4
    },
    {
      id: S.featureId(281, 5),
      label: 'Talons',
      description:
        'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 14 (2d10 + 3) slashing damage.',
      order: 5
    },
    {
      id: S.featureId(281, 6),
      label: 'Spores (Recharge 6)',
      description:
        'Spores (Recharge 6). A 15-foot-radius cloud of toxic spores extends out from the vrock. The spores spread around corners. Each creature in that area must succeed on a DC 14 Constitution saving throw or become poisoned. While poisoned in this way, a target takes 5 (1d10) poison damage at the start of each of its turns. A target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. Emptying a vial of holy water on the target also ends the effect on it.',
      order: 6
    },
    {
      id: S.featureId(281, 7),
      label: 'Stunning Screech (1/Day)',
      description:
        "Stunning Screech (1/Day). The vrock emits a horrific screech. Each creature within 20 feet of it that can hear it and that isn't a demon must succeed on a DC 14 Constitution saving throw or be stunned until the end of the vrock's next turn.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(281, 15),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.LONG_REST,
        amount: 1
      },
      order: 7
    }
  ]
}
