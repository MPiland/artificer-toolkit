import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { CHANGE_SHAPE_RULING } from './changeShapeRuling.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const succubusIncubus: CreatureAuthored = {
  id: S.CREATURE_IDS.SUCCUBUS_INCUBUS,
  label: 'Succubus/Incubus',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  tags: ['shapechanger'],
  abilityScores: {
    STRENGTH: 8,
    DEXTERITY: 17,
    CONSTITUTION: 13,
    INTELLIGENCE: 15,
    WISDOM: 12,
    CHARISMA: 20
  },
  naturalArmorBonus: 2,
  hitPoints: 66,
  details: [],
  damageVulnerabilities: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 12,
    die: 8,
    modifier: 12
  },
  speeds: [...S.walk(30), ...S.fly(60)],
  proficiencies: [
    S.grantedLanguageProficiency(267, 2, 'ABYSSAL', 'COMMON', 'INFERNAL'),
    S.grantedSkillExpertise(267, 1, 'DECEPTION', 'INSIGHT', 'PERCEPTION', 'PERSUASION', 'STEALTH')
  ],
  damageResistances: [
    'cold',
    'fire',
    'lightning',
    'poison',
    'bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  senses: [S.darkvision(60)],
  passivePerception: 15,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(267, 5),
      label: 'Telepathy',
      description: 'telepathy 60 ft.',
      order: 0
    },
    {
      id: S.featureId(267, 1),
      label: 'Shapechanger',
      description:
        "Shapechanger. The fiend can use its action to polymorph into a Small or Medium humanoid, or back into its true form. Without wings, the fiend loses its flying speed. Other than its size and speed, its statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(267, 200),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(267, 201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ...CHANGE_SHAPE_RULING.SIZED_FORM
        })
      ],
      order: 1
    },
    {
      id: S.featureId(267, 2),
      label: 'Telepathic Bond',
      description:
        "Telepathic Bond. The fiend ignores the range restriction on its telepathy when communicating with a creature it has charmed. The two don't even need to be on the same plane of existence.",
      order: 2
    },
    {
      id: S.featureId(267, 3),
      label: 'Draining Kiss',
      description:
        "Draining Kiss. The fiend kisses a creature charmed by it or a willing creature. The target must make a DC 15 Constitution saving throw against this magic, taking 32 (5d10 + 5) psychic damage on a failed save, or half as much damage on a successful one. The target's hit point maximum is reduced by an amount equal to the damage taken. This reduction lasts until the target finishes a long rest. The target dies if this effect reduces its hit point maximum to 0.",
      effects: [
        {
          id: S.actionId(267, 204),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(267, 205),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 15
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(267, 206), rangeKind: S.RANGE_KIND.TOUCH },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(267, 207),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(267, 208),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(267, 209),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PSYCHIC'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '5d10+5',
                    multiplier: 1
                  },
                  {
                    id: S.actionId(267, 210),
                    effectKind: S.EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION,
                    amountSource: { kind: 'DAMAGE_TAKEN', damageOutcomeId: S.actionId(267, 209) },
                    recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
                  }
                ]
              }
            },
            {
              id: S.actionId(267, 211),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(267, 212),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(267, 213),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PSYCHIC'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '5d10+5',
                    multiplier: 0.5
                  },
                  {
                    id: S.actionId(267, 214),
                    effectKind: S.EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION,
                    amountSource: { kind: 'DAMAGE_TAKEN', damageOutcomeId: S.actionId(267, 213) },
                    recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(267, 4),
      label: 'Claw (Fiend Form Only)',
      description:
        'Claw (Fiend Form Only). Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(7009, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7009, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(7009, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7009, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7009, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+3'
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
      id: S.featureId(267, 6),
      label: 'Charm',
      description:
        "Charm. One humanoid the fiend can see within 30 feet of it must succeed on a DC 15 Wisdom saving throw or be magically charmed for 1 day. The charmed target obeys the fiend's verbal or telepathic commands. If the target suffers any harm or receives a suicidal command, it can repeat the saving throw, ending the effect on a success. If the target successfully saves against the effect, or if the effect on it ends, the target is immune to this fiend's Charm for the next 24 hours. The fiend can have only one target charmed at a time. If it charms another, the effect on the previous target ends.",
      effects: [
        {
          id: S.actionId(267, 300),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            savingThrow: {
              id: S.actionId(267, 301),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 15
            },
            range: {
              id: S.actionId(267, 302),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 30,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(267, 303),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(267, 303)}__result`,
                resultKind: 'SINGLE',
                duration: {
                  id: S.actionId(267, 304),
                  durationKind: DURATION_KIND.DAY,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(267, 305),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('CHARMED')
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(267, 7),
      label: 'Etherealness',
      description:
        'Etherealness. The fiend magically enters the Ethereal Plane from the Material Plane, or vice versa.',
      order: 6
    }
  ]
}
