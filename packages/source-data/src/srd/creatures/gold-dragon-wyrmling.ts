import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
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
    CHARISMA: 16
  },
  naturalArmorBonus: 5,
  hitPoints: 60,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 8,
    die: 8,
    modifier: 24
  },
  speeds: [...S.walk(30), ...S.fly(60), ...S.swim(30)],
  proficiencies: [
    S.grantedSkillExpertise(3328, 4, 'PERCEPTION'),
    S.grantedSaveProficiency(3328, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(3328, 2, 'STEALTH'),
    S.grantedLanguageProficiency(3328, 3, 'DRACONIC')
  ],
  damageImmunities: ['fire'],
  senses: [S.blindsight(10), S.darkvision(60)],
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
      description:
        'Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 9 (1d10 + 4) piercing damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 147,
          localIndex: 1,
          kind: 'MELEE',
          feet: 5,
          damageType: 'PIERCING',
          diceConfig: '1d10',
          ability: 'STRENGTH'
        })
      ],
      order: 2
    },
    {
      id: S.featureId(147, 3),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(147, 3)),
      label: 'Breath Weapons (Recharge 5-6)',
      description:
        'Breath Weapons (Recharge 5-6). The dragon uses one of the following breath weapons. Fire Breath. The dragon exhales fire in a 15-foot cone. Each creature in that area must make a DC 13 Dexterity saving throw, taking 22 (4d10) fire damage on a failed save, or half as much damage on a successful one. Weakening Breath. The dragon exhales gas in a 15-foot cone. Each creature in that area must succeed on a DC 13 Strength saving throw or have disadvantage on Strength-based attack rolls, Strength checks, and Strength saving throws for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      effects: [
        {
          id: S.actionId(147, 20),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(147, 21),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: S.SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 13
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            ...S.selfCone(S.actionId(147, 22), S.actionId(147, 38), 15)
          },
          paths: [
            {
              id: S.actionId(147, 23),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(147, 23)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(147, 24),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d10'
                  }
                ]
              }
            },
            {
              id: S.actionId(147, 25),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(147, 25)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(147, 26),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d10',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        },
        {
          id: S.actionId(147, 30),
          order: 2,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(147, 31),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: S.SRD_ABILITY_DEFINITION_IDS.STRENGTH,
              baseDc: 13
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            ...S.selfCone(S.actionId(147, 32), S.actionId(147, 39), 15)
          },
          paths: [
            {
              id: S.actionId(147, 33),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(147, 900),
                resultKind: 'SEQUENCE',
                duration: {
                  id: S.actionId(147, 34),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(147, 901),
                    effectKind: S.EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: [
                        {
                          id: S.actionId(147, 902),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'ABILITY_CHECK',
                          domain: { ability: S.ABILITY_CODE.STRENGTH },
                          modifierKind: 'ROLL_INFLUENCE',
                          payload: { influence: 'DISADVANTAGE' },
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          order: 1
                        },
                        {
                          id: S.actionId(147, 903),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'SAVING_THROW_MODIFIER',
                          domain: { ability: S.ABILITY_CODE.STRENGTH },
                          modifierKind: 'ROLL_INFLUENCE',
                          payload: { influence: 'DISADVANTAGE' },
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          order: 2
                        },
                        {
                          id: S.actionId(147, 904),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'ATTACK_ROLL',
                          domain: { attackDomain: 'MELEE', ability: S.ABILITY_CODE.STRENGTH },
                          modifierKind: 'ROLL_INFLUENCE',
                          payload: { influence: 'DISADVANTAGE' },
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          order: 3
                        },
                        {
                          id: S.actionId(147, 905),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'ATTACK_ROLL',
                          domain: { attackDomain: 'RANGED', ability: S.ABILITY_CODE.STRENGTH },
                          modifierKind: 'ROLL_INFLUENCE',
                          payload: { influence: 'DISADVANTAGE' },
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          order: 4
                        },
                        {
                          id: S.actionId(147, 906),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'ATTACK_ROLL',
                          domain: { attackDomain: 'UNARMED', ability: S.ABILITY_CODE.STRENGTH },
                          modifierKind: 'ROLL_INFLUENCE',
                          payload: { influence: 'DISADVANTAGE' },
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          order: 5
                        }
                      ]
                    }
                  },
                  {
                    id: S.actionId(147, 35),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'TARGET_TURN_END',
                    savingThrow: {
                      id: S.actionId(147, 36),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: S.SRD_ABILITY_DEFINITION_IDS.STRENGTH,
                      baseDc: 13
                    },
                    attempts: { kind: 'ONCE', repeatOnFailure: true },
                    onSuccess: { kind: 'END' },
                    onFailure: { kind: 'CONTINUE' }
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 3
    }
  ]
}
