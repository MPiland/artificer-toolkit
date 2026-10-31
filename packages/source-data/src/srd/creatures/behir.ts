import type { CreatureAuthored } from '@artificer-toolkit/shared'

import * as S from './shared.js'

export const behir: CreatureAuthored = {
  id: S.CREATURE_IDS.BEHIR,
  label: 'Behir',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 23,
    DEXTERITY: 16,
    CONSTITUTION: 18,
    INTELLIGENCE: 7,
    WISDOM: 14,
    CHARISMA: 12
  },
  naturalArmorBonus: 4,
  hitPoints: 168,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 16,
    die: 12,
    modifier: 64
  },
  speeds: [...S.walk(50), ...S.climb(40)],
  proficiencies: [
    S.grantedSkillProficiency(43, 1, 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(43, 2, 'DRACONIC')
  ],
  damageImmunities: ['lightning'],
  senses: [S.darkvision(90)],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_11,
  xp: 7200,
  features: [
    {
      id: S.featureId(43, 1),
      label: 'Multiattack',
      description:
        'Multiattack. The behir makes two attacks: one with its bite and one to constrict.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(43, 2) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(43, 3) }] }
            ]
          }
        ]
      },
      order: 1
    },
    {
      id: S.featureId(43, 2),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 22 (3d10 + 6) piercing damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 43,
          localIndex: 1,
          kind: 'MELEE',
          feet: 10,
          damageType: 'PIERCING',
          diceConfig: '3d10',
          ability: 'STRENGTH'
        })
      ],
      order: 2
    },
    {
      id: S.featureId(43, 3),
      label: 'Constrict',
      description:
        "Constrict. Melee Weapon Attack: +10 to hit, reach 5 ft., one Large or smaller creature. Hit: 17 (2d10 + 6) bludgeoning damage plus 17 (2d10 + 6) slashing damage. The target is grappled (escape DC 16) if the behir isn't already constricting a creature, and the target is restrained until this grapple ends.",
      effects: [
        S.weaponAttack({
          creatureIndex: 43,
          localIndex: 21,
          kind: 'MELEE',
          feet: 5,
          damageType: 'BLUDGEONING',
          diceConfig: '2d10',
          ability: 'STRENGTH',
          extraDamage: [{ damageType: 'SLASHING', diceConfig: '2d10+6' }],
          grapple: {
            localIndex: 1,
            escapeDc: 16,
            heldAtOnce: 1,
            largestTarget: S.SIZE_CODE.LARGE,
            untilEnds: ['RESTRAINED']
          }
        })
      ],
      order: 3
    },
    {
      id: S.featureId(43, 4),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      label: 'Lightning Breath (Recharge 5-6)',
      description:
        'Lightning Breath (Recharge 5-6). The behir exhales a line of lightning that is 20 feet long and 5 feet wide. Each creature in that line must make a DC 16 Dexterity saving throw, taking 66 (12d10) lightning damage on a failed save, or half as much damage on a successful one.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(43, 15),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 1
      },
      effects: [
        {
          id: S.actionId(43, 31),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(43, 32),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: S.SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 16
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            ...S.selfLine(S.actionId(43, 33), S.actionId(43, 36), 20, 5)
          },
          paths: [
            {
              id: S.actionId(43, 34),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(43, 34) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(43, 34),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('LIGHTNING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '12d10'
                  }
                ]
              }
            },
            {
              id: S.actionId(43, 35),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(43, 35) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(43, 35),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('LIGHTNING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '12d10',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(43, 5),
      label: 'Swallow',
      description:
        "Swallow. The behir makes one bite attack against a Medium or smaller target it is grappling. If the attack hits, the target is also swallowed, and the grapple ends. While swallowed, the target is blinded and restrained, it has total cover against attacks and other effects outside the behir, and it takes 21 (6d6) acid damage at the start of each of the behir's turns. A behir can have only one creature swallowed at a time. If the behir takes 30 damage or more on a single turn from the swallowed creature, the behir must succeed on a DC 14 Constitution saving throw at the end of that turn or regurgitate the creature, which falls prone in a space within 10 feet of the behir. If the behir dies, a swallowed creature is no longer restrained by it and can escape from the corpse by using 15 feet of movement, exiting prone.",
      effects: [
        S.heldByUseEffect({
          effectId: S.actionId(43, 40),
          rangeId: S.actionId(43, 41),
          pathId: S.actionId(43, 42),
          outcome: S.swallowedOutcome(43, {
            localIndex: 10,
            damageOutcomeId: S.actionId(43, 43),
            escapeDc: 16,
            heldAtOnce: 1,
            largestTarget: S.SIZE_CODE.MEDIUM,
            damageType: 'ACID',
            diceConfig: '6d6'
          })
        })
      ],
      order: 5
    }
  ]
}
