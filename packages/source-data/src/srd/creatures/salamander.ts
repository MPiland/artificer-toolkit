import type { CreatureAuthored } from '@artificer-toolkit/shared'

import * as S from './shared.js'

export const salamander: CreatureAuthored = {
  id: S.CREATURE_IDS.SALAMANDER,
  label: 'Salamander',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 14,
    CONSTITUTION: 15,
    INTELLIGENCE: 11,
    WISDOM: 10,
    CHARISMA: 12
  },
  armorClass: 15,
  armorClassNote: 'natural armor',
  hitPoints: 90,
  hitDice: {
    count: 12,
    die: 10,
    modifier: 24
  },
  speeds: [...S.walk(30)],
  proficiencies: [S.grantedLanguageProficiency(244, 1, 'IGNAN')],
  damageVulnerabilities: ['cold'],
  damageResistances: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['fire'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(244, 1),
      label: 'Heated Body',
      description:
        'Heated Body. A creature that touches the salamander or hits it with a melee attack while within 5 feet of it takes 7 (2d6) fire damage.',
      order: 1
    },
    {
      id: S.featureId(244, 2),
      label: 'Heated Weapons',
      description:
        'Heated Weapons. Any metal melee weapon the salamander wields deals an extra 3 (1d6) fire damage on a hit (included in the attack).',
      order: 2
    },
    {
      id: S.featureId(244, 3),
      label: 'Multiattack',
      description:
        'Multiattack. The salamander makes two attacks: one with its spear and one with its tail.',
      order: 3
    },
    {
      id: S.featureId(244, 4),
      label: 'Spear',
      description:
        'Spear. Melee or Ranged Weapon Attack: +7 to hit, reach 5 ft. or range 20 ft./60 ft., one target. Hit: 11 (2d6 + 4) piercing damage, or 13 (2d8 + 4) piercing damage if used with two hands to make a melee attack, plus 3 (1d6) fire damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 244,
          localIndex: 1,
          kind: 'MELEE',
          feet: 5,
          damageType: 'PIERCING',
          diceConfig: '2d6',
          ability: 'STRENGTH',
          extraDamage: [{ damageType: 'FIRE', diceConfig: '1d6' }]
        }),
        S.weaponAttack({
          creatureIndex: 244,
          localIndex: 11,
          kind: 'RANGED',
          feet: 20,
          longFeet: 60,
          damageType: 'PIERCING',
          diceConfig: '2d6',
          ability: 'STRENGTH',
          extraDamage: [{ damageType: 'FIRE', diceConfig: '1d6' }]
        })
      ],
      order: 4
    },
    {
      id: S.featureId(244, 5),
      label: 'Tail',
      description:
        "Tail. Melee Weapon Attack: +7 to hit, reach 10 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage plus 7 (2d6) fire damage, and the target is grappled (escape DC 14). Until this grapple ends, the target is restrained, the salamander can automatically hit the target with its tail, and the salamander can't make tail attacks against other targets.",
      effects: [
        S.weaponAttack({
          creatureIndex: 244,
          localIndex: 21,
          kind: 'MELEE',
          feet: 10,
          damageType: 'BLUDGEONING',
          diceConfig: '2d6',
          ability: 'STRENGTH',
          extraDamage: [{ damageType: 'FIRE', diceConfig: '2d6' }],
          grapple: { localIndex: 1, escapeDc: 14, heldAtOnce: 1, untilEnds: ['RESTRAINED'] }
        })
      ],
      order: 5
    }
  ]
}
