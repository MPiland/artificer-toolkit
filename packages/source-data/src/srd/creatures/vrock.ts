import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import { conditionTypeId } from '../equipment/shared.js'

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
  naturalArmorBonus: 3,
  hitPoints: 104,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
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
  senses: [S.darkvision(120)],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_6,
  xp: 2300,
  features: [
    {
      id: S.featureId(281, 1),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The vrock has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(281, 200),
      order: 1
    },
    {
      id: S.featureId(281, 2),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 2
    },
    {
      id: S.featureId(281, 3),
      label: 'Multiattack',
      description: 'The vrock makes two attacks: one with its beak and one with its talons.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(281, 4) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(281, 5) }] }
            ]
          }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(281, 4),
      label: 'Beak',
      description:
        'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) piercing damage.',
      effects: [
        {
          id: S.actionId(281, 204),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(281, 205),
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
              id: S.actionId(281, 206),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(281, 207),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(281, 208),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+3'
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
      id: S.featureId(281, 5),
      label: 'Talons',
      description:
        'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 14 (2d10 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(281, 209),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(281, 210),
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
              id: S.actionId(281, 211),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(281, 212),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(281, 213),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d10+3'
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
      id: S.featureId(281, 6),
      ruleDefinitionIds: [S.DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(281, 6)),
      label: 'Spores (Recharge 6)',
      description:
        'Spores (Recharge 6). A 15-foot-radius cloud of toxic spores extends out from the vrock. The spores spread around corners. Each creature in that area must succeed on a DC 14 Constitution saving throw or become poisoned. While poisoned in this way, a target takes 5 (1d10) poison damage at the start of each of its turns. A target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. Emptying a vial of holy water on the target also ends the effect on it.',
      effects: [
        {
          id: S.actionId(281, 214),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(281, 215),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 14
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(281, 216), rangeKind: S.RANGE_KIND.SELF },
            shape: {
              id: S.actionId(281, 217),
              shapeKind: 'SPHERE',
              radius: { amount: 15, unit: S.MEASUREMENT_UNIT_CODE.FEET }
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(281, 227),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(281, 228),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(281, 229),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('POISONED')
                  },
                  {
                    id: S.actionId(281, 230),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.TARGET_TURN_END,
                    savingThrow: {
                      id: S.actionId(281, 231),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 14
                    },
                    attempts: { kind: 'ONCE', repeatOnFailure: true },
                    onSuccess: { kind: 'END' },
                    onFailure: { kind: 'CONTINUE' }
                  },
                  {
                    id: S.actionId(281, 232),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Spore damage',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions:
                      'While poisoned in this way, the target takes 5 (1d10) poison damage at the start of each of its turns. Emptying a vial of holy water on the target also ends the effect on it.'
                  }
                ]
              }
            }
          ]
        }
      ],
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
      effects: [
        {
          id: S.actionId(281, 218),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(281, 219),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 14
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(281, 220),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 20,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(281, 221),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(281, 221)}__result`,
                resultKind: 'SEQUENCE',
                duration: {
                  id: S.actionId(281, 222),
                  durationKind: DURATION_KIND.ROUND,
                  amount: 1
                },
                // "Until the end of the vrock's next turn."
                lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } },
                outcomes: [
                  {
                    id: S.actionId(281, 223),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('STUNNED')
                  },
                  {
                    id: S.actionId(281, 224),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Demons and creatures that cannot hear',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions:
                      "Demons and creatures that can't hear the screech are unaffected; the GM ends the stun on any of them."
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 7
    }
  ]
}
