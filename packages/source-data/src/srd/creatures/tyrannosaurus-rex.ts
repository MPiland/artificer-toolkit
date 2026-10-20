import type { CreatureAuthored } from '@artificer-toolkit/shared'

import * as S from './shared.js'

export const tyrannosaurusRex: CreatureAuthored = {
  id: S.CREATURE_IDS.TYRANNOSAURUS_REX,
  label: 'Tyrannosaurus Rex',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 25,
    DEXTERITY: 10,
    CONSTITUTION: 19,
    INTELLIGENCE: 2,
    WISDOM: 12,
    CHARISMA: 9
  },
  naturalArmorBonus: 3,
  hitPoints: 136,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 13,
    die: 12,
    modifier: 52
  },
  speeds: [...S.walk(50)],
  proficiencies: [S.grantedSkillProficiency(275, 1, 'PERCEPTION')],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_8,
  xp: 3900,
  features: [
    {
      id: S.featureId(275, 1),
      label: 'Multiattack',
      description:
        "Multiattack. The tyrannosaurus makes two attacks: one with its bite and one with its tail. It can't make both attacks against the same target.",
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(275, 2) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(275, 3) }] }
            ]
          }
        ]
      },
      order: 1
    },
    {
      id: S.featureId(275, 2),
      label: 'Bite',
      description:
        "Bite. Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 33 (4d12 + 7) piercing damage. If the target is a Medium or smaller creature, it is grappled (escape DC 17). Until this grapple ends, the target is restrained, and the tyrannosaurus can't bite another target.",
      effects: [
        S.weaponAttack({
          creatureIndex: 275,
          localIndex: 1,
          kind: 'MELEE',
          feet: 10,
          damageType: 'PIERCING',
          diceConfig: '4d12',
          ability: 'STRENGTH',
          grapple: {
            localIndex: 1,
            escapeDc: 17,
            heldAtOnce: 1,
            largestTarget: S.SIZE_CODE.MEDIUM,
            untilEnds: ['RESTRAINED']
          }
        })
      ],
      order: 2
    },
    {
      id: S.featureId(275, 3),
      label: 'Tail',
      description:
        'Tail. Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 20 (3d8 + 7) bludgeoning damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 275,
          localIndex: 11,
          kind: 'MELEE',
          feet: 10,
          damageType: 'BLUDGEONING',
          diceConfig: '3d8',
          ability: 'STRENGTH'
        })
      ],
      order: 3
    }
  ]
}
