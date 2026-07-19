import type { CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const willOWisp: CreatureAuthored = {
    id: S.CREATURE_IDS.WILL_O_WISP,
    label: "Will-o'-Wisp",
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.UNDEAD,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000900000000',
    tags: ['hover'],
    abilityScores: {
        STRENGTH: 1,
        DEXTERITY: 28,
        CONSTITUTION: 10,
        INTELLIGENCE: 13,
        WISDOM: 14,
        CHARISMA: 11,
    },
    armorClass: 19,
    hitPoints: 22,
    hitDice: '9d4',
    speeds: [...S.walk(0), ...S.fly(50)],
    damageResistances: ['acid, cold, fire, necrotic, thunder; bludgeoning, piercing, and slashing from nonmagical attacks'],
    damageImmunities: ['lightning', 'poison'],
    conditionImmunities: ['exhaustion', 'grappled', 'paralyzed', 'poisoned', 'prone', 'restrained', 'unconscious'],
    senses: ['darkvision 120 ft.'],
    passivePerception: 12,
    challengeRatingId: S.CR.CR_2,
    xp: 450,
    features: [
        {
            id: S.featureId(294, 1),
            label: 'Consume Life',
            description: "Consume Life. As a bonus action, the will-o'-wisp can target one creature it can see within 5 feet of it that has 0 hit points and is still alive. The target must succeed on a DC 10 Constitution saving throw against this magic or die. If the target dies, the will-o'-wisp regains 10 (3d6) hit points.",
            order: 1
        },
        {
            id: S.featureId(294, 2),
            label: 'Ephemeral',
            description: "Ephemeral. The will-o'-wisp can't wear or carry anything.",
            order: 2
        },
        {
            id: S.featureId(294, 3),
            label: 'Incorporeal Movement',
            description: "Incorporeal Movement. The will-o'-wisp can move through other creatures and objects as if they were difficult terrain. It takes 5 (1d10) force damage if it ends its turn inside an object.",
            order: 3
        },
        {
            id: S.featureId(294, 4),
            label: 'Variable Illumination',
            description: "Variable Illumination. The will-o'-wisp sheds bright light in a 5- to 20-foot radius and dim light for an additional number of feet equal to the chosen radius. The will-o'-wisp can alter the radius as a bonus action.",
            order: 4
        },
        {
            id: S.featureId(294, 5),
            label: 'Language Knowledge',
            description: 'The languages it knew in life.',
            order: 5
        },
        {
            id: S.featureId(294, 6),
            label: 'Shock',
            description: 'Shock. Melee Spell Attack: +4 to hit, reach 5 ft., one creature. Hit: 9 (2d8) lightning damage.',
            effects: [
                {
                    id: S.actionId(294, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(294, 2),
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
                            id: S.actionId(294, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(294, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(294, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('LIGHTNING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8'
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
            id: S.featureId(294, 7),
            label: 'Invisibility',
            description: "Invisibility. The will-o'-wisp and its light magically become invisible until it attacks or uses its Consume Life, or until its concentration ends (as if concentrating on a spell).",
            effects: [
                {
                    id: S.actionId(294, 4),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.BONUS_ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(294, 5),
                            rangeKind: S.RANGE_KIND.SELF
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(294, 6),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(294, 6) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(294, 6),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('INVISIBLE')
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
};


