import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  ATTACK_OCCASION_CODE,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  EQUIPMENT_PROPERTY_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_CONDITION_TYPES, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { closedRuleEffect } from './mechanics.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

function conditionTypeId(code: string): string {
  const entry = SRD_CONDITION_TYPES.find((c) => c.code === code)
  if (!entry) throw new Error(`SRD condition type vocabulary entry for ${code} required.`)
  return entry.id
}

const RA = 8

export const hunterConclave: ClassAuthored = {
  id: SUBCLASS_IDS.HUNTER,
  label: 'Hunter',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.RANGER,
  description:
    "Emulating the Hunter archetype means accepting your place as a bulwark between civilization and the terrors of the wilderness. As you walk the Hunter's path, you learn specialized techniques for fighting the threats you face, from rampaging ogres and hordes of orcs to towering giants and terrifying dragons.",
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(RA, 11, 1),
      label: "Hunter's Prey",
      description: 'At 3rd level, you gain one of the following features of your choice.',
      availableAtLevel: 3,
      order: 0,
      optionChoices: [{ level: 3, count: 1 }],
      options: [
        {
          id: classRowId(RA, 12, 1),
          label: 'Colossus Slayer',
          description:
            "Your tenacity can wear down the most potent foes. When you hit a creature with a weapon attack, the creature takes an extra 1d8 damage if it's below its hit point maximum. You can deal this extra damage only once per turn.",
          order: 0,
          effects: [
            closedRuleEffect({
              id: classRowId(RA, 20, 1),
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
                range: { id: classRowId(RA, 21, 1), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'ANY'
                }
              },
              pathCode: PATH_CODE.ON_HIT,
              ruleKind: CLOSED_RULE_KIND.CLASS_HUNTER_COLOSSUS_SLAYER
            }),
            closedRuleEffect({
              id: classRowId(RA, 20, 11),
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
                range: { id: classRowId(RA, 21, 11), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'ANY'
                }
              },
              pathCode: PATH_CODE.ON_HIT,
              ruleKind: CLOSED_RULE_KIND.CLASS_HUNTER_COLOSSUS_SLAYER
            })
          ]
        },
        {
          id: classRowId(RA, 12, 2),
          label: 'Giant Killer',
          description:
            'When a Large or larger creature within 5 feet of you hits or misses you with an attack, you can use your reaction to attack that creature immediately after its attack, provided that you can see the creature.',
          order: 1,
          effects: [
            closedRuleEffect({
              id: classRowId(RA, 20, 2),
              invocation: {
                kind: 'ACTION',
                triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
                activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
                range: {
                  id: classRowId(RA, 21, 2),
                  rangeKind: RANGE_KIND.DISTANCE,
                  amount: 5,
                  unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'ANY'
                }
              },
              pathCode: PATH_CODE.ON_ATTACK,
              ruleKind: CLOSED_RULE_KIND.CLASS_HUNTER_GIANT_KILLER
            })
          ]
        },
        {
          id: classRowId(RA, 12, 3),
          label: 'Horde Breaker',
          description:
            'Once on each of your turns when you make a weapon attack, you can make another attack with the same weapon against a different creature that is within 5 feet of the original target and within range of your weapon.',
          order: 2,
          effects: [
            closedRuleEffect({
              id: classRowId(RA, 20, 3),
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
                range: { id: classRowId(RA, 21, 3), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'ANY'
                }
              },
              pathCode: PATH_CODE.ON_ATTACK,
              ruleKind: CLOSED_RULE_KIND.CLASS_HUNTER_HORDE_BREAKER
            }),
            closedRuleEffect({
              id: classRowId(RA, 20, 12),
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
                range: { id: classRowId(RA, 21, 12), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'ANY'
                }
              },
              pathCode: PATH_CODE.ON_ATTACK,
              ruleKind: CLOSED_RULE_KIND.CLASS_HUNTER_HORDE_BREAKER
            })
          ]
        }
      ]
    },
    {
      id: classRowId(RA, 11, 2),
      label: 'Defensive Tactics',
      description: 'At 7th level, you gain one of the following features of your choice.',
      availableAtLevel: 7,
      order: 1,
      optionChoices: [{ level: 7, count: 1 }],
      options: [
        {
          id: classRowId(RA, 13, 1),
          label: 'Escape the Horde',
          description: 'Opportunity attacks against you are made with disadvantage.',
          order: 0,
          grants: {
            modifiers: Object.values(ATTACK_DOMAIN_CODE).map((attackDomain, index) => ({
              id: classRowId(RA, 23, index + 1),
              grantKind: GRANT_KIND.MODIFIER_GRANT,
              valueDomainCode: VALUE_DOMAIN_CODE.ATTACKS_AGAINST,
              domain: {
                attackDomain,
                requiresHolderSeesAttacker: false,
                attackOccasion: ATTACK_OCCASION_CODE.OPPORTUNITY
              },
              modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
              payload: { influence: 'DISADVANTAGE' },
              scope: MODIFIER_SCOPE_KIND.GLOBAL,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              order: index
            }))
          }
        },
        {
          id: classRowId(RA, 13, 2),
          label: 'Multiattack Defense',
          description:
            'When a creature hits you with an attack, you gain a +4 bonus to AC against all subsequent attacks made by that creature for the rest of the turn.',
          order: 1,
          effects: [
            closedRuleEffect({
              id: classRowId(RA, 20, 5),
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.ACTIVATED,
                range: { id: classRowId(RA, 21, 5), rangeKind: RANGE_KIND.SELF },
                targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
              },
              ruleKind: CLOSED_RULE_KIND.CLASS_HUNTER_MULTIATTACK_DEFENSE
            })
          ]
        },
        {
          id: classRowId(RA, 13, 3),
          label: 'Steel Will',
          description: 'You have advantage on saving throws against being frightened.',
          order: 2,
          grants: {
            // Frightening effects call for saves of any ability, so each ability gets the advantage.
            modifiers: Object.values(ABILITY_CODE).map((ability, index) => ({
              id: classRowId(RA, 13, 4 + index),
              grantKind: GRANT_KIND.MODIFIER_GRANT,
              valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
              domain: {
                ability,
                conditionTypeId: conditionTypeId('FRIGHTENED')
              },
              modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
              payload: { influence: 'ADVANTAGE' },
              scope: MODIFIER_SCOPE_KIND.GLOBAL,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              order: index
            }))
          }
        }
      ]
    },
    {
      id: classRowId(RA, 11, 3),
      label: "Hunter's Multiattack",
      description: 'At 11th level, you gain one of the following features of your choice.',
      availableAtLevel: 11,
      order: 2,
      optionChoices: [{ level: 11, count: 1 }],
      options: [
        {
          id: classRowId(RA, 14, 1),
          label: 'Volley',
          description:
            "You can use your action to make a ranged attack against any number of creatures within 10 feet of a point you can see within your weapon's range. You must have ammunition for each target, as normal, and you make a separate attack roll for each target.",
          order: 0,
          // An attack with each wielded ammunition weapon, within that weapon's range (D156).
          // Each attack draws one piece of the chosen ammunition when the Campaign tracks it (ATTACK-19.4).
          effects: [
            {
              id: classRowId(RA, 20, 6),
              order: 0,
              invocation: {
                kind: 'ACTION',
                triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
                activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
                range: { id: classRowId(RA, 21, 6), rangeKind: RANGE_KIND.SPECIAL },
                shape: {
                  id: classRowId(RA, 22, 6),
                  shapeKind: SHAPE_KIND.SPHERE,
                  radius: { amount: 10, unit: MEASUREMENT_UNIT_CODE.FEET }
                },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
                  dispositionKind: 'ANY'
                }
              },
              weaponAttack: { requiredPropertyCodes: [EQUIPMENT_PROPERTY_CODE.AMMUNITION] },
              paths: []
            }
          ]
        },
        {
          id: classRowId(RA, 14, 2),
          label: 'Whirlwind Attack',
          description:
            'You can use your action to make a melee attack against any number of creatures within 5 feet of you, with a separate attack roll for each target.',
          order: 1,
          // An attack with each wielded melee weapon, no farther than 5 feet (D156).
          effects: [
            {
              id: classRowId(RA, 20, 7),
              order: 0,
              invocation: {
                kind: 'ACTION',
                triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
                activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
                range: {
                  id: classRowId(RA, 21, 7),
                  rangeKind: RANGE_KIND.DISTANCE,
                  amount: 5,
                  unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
                  dispositionKind: 'ANY'
                }
              },
              weaponAttack: {},
              paths: []
            }
          ]
        }
      ]
    },
    {
      id: classRowId(RA, 11, 4),
      label: "Superior Hunter's Defense",
      description: 'At 15th level, you gain one of the following features of your choice.',
      availableAtLevel: 15,
      order: 3,
      optionChoices: [{ level: 15, count: 1 }],
      options: [
        {
          id: classRowId(RA, 15, 1),
          label: 'Evasion',
          description:
            "When you are subjected to an effect, such as a red dragon's fiery breath or a lightning bolt spell, that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.",
          order: 0,
          effects: [
            closedRuleEffect({
              id: classRowId(RA, 20, 8),
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.ACTIVATED,
                range: { id: classRowId(RA, 21, 8), rangeKind: RANGE_KIND.SELF },
                targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
              },
              ruleKind: CLOSED_RULE_KIND.CLASS_HUNTER_EVASION
            })
          ]
        },
        {
          id: classRowId(RA, 15, 2),
          label: 'Stand Against the Tide',
          description:
            'When a hostile creature misses you with a melee attack, you can use your reaction to force that creature to repeat the same attack against another creature (other than itself) of your choice.',
          order: 1,
          effects: [
            closedRuleEffect({
              id: classRowId(RA, 20, 9),
              invocation: {
                kind: 'ACTION',
                triggerCode: TRIGGER.ACTIVATED,
                activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
                range: { id: classRowId(RA, 21, 9), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'HOSTILE'
                }
              },
              ruleKind: CLOSED_RULE_KIND.CLASS_HUNTER_STAND_AGAINST_THE_TIDE
            })
          ]
        },
        {
          id: classRowId(RA, 15, 3),
          label: 'Uncanny Dodge',
          description:
            "When an attacker that you can see hits you with an attack, you can use your reaction to halve the attack's damage against you.",
          order: 2,
          effects: [
            closedRuleEffect({
              id: classRowId(RA, 20, 10),
              invocation: {
                kind: 'ACTION',
                triggerCode: TRIGGER.ACTIVATED,
                activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
                range: { id: classRowId(RA, 21, 10), rangeKind: RANGE_KIND.SIGHT },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'ANY'
                }
              },
              ruleKind: CLOSED_RULE_KIND.CLASS_HUNTER_UNCANNY_DODGE
            })
          ]
        }
      ]
    }
  ]
}
