import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const tarrasque: CreatureAuthored = {
    id: S.CREATURE_IDS.TARRASQUE,
    label: 'Tarrasque',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
    size: S.SIZE_CODE.GARGANTUAN,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 30,
        DEXTERITY: 11,
        CONSTITUTION: 30,
        INTELLIGENCE: 3,
        WISDOM: 11,
        CHARISMA: 11,
    },
    armorClass: 25,
    armorClassNote: 'natural armor',
    hitPoints: 676,
    hitDice: '33d20+330',
    speeds: [...S.walk(40)],
    damageImmunities: ['fire', 'poison'],
    conditionImmunities: ['charmed', 'frightened', 'paralyzed', 'poisoned', 'stunned'],
    senses: ['blindsight 120 ft.'],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_30,
    xp: 155000,
    features: [
        {
            id: S.featureId(268, 1),
            label: 'Legendary Resistance',
            description: 'Legendary Resistance. If the tarrasque fails a saving throw, it can choose to succeed instead.',
            order: 1
        },
        {
            id: S.featureId(268, 2),
            label: 'Reflective Carapace',
            description: 'Reflective Carapace. Spells that target the tarrasque with ranged spell attacks or that require the tarrasque to make a saving throw against a spell have a chance to bounce back at the caster.',
            order: 2
        },
        {
            id: S.featureId(268, 3),
            label: 'Siege Monster',
            description: 'Siege Monster. The tarrasque deals double damage to objects and structures.',
            order: 3
        },
        {
            id: S.featureId(268, 4),
            label: 'Multiattack',
            description: 'Multiattack. The tarrasque makes five attacks: one with its bite, two with its claws, one with its horns, and one with its tail. It can use its Swallow instead of its bite.',
            order: 4
        },
        {
            id: S.featureId(268, 5),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +19 to hit, reach 10 ft., one target. Hit: 36 (4d12 + 10) piercing damage. If the target is a creature, it is grappled (escape DC 20).',
            effects: [
                {
                    id: S.actionId(2982, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(2982, 2),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 10,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                            dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(2982, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(2982, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(2982, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '4d12+10'
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
            id: S.featureId(268, 6),
            label: 'Claws',
            description: 'Claws. Melee Weapon Attack: +19 to hit, reach 15 ft., one target. Hit: 28 (4d8 + 10) slashing damage.',
            order: 6
        },
        {
            id: S.featureId(268, 7),
            label: 'Horns',
            description: 'Horns. Melee Weapon Attack: +19 to hit, reach 10 ft., one target. Hit: 32 (4d10 + 10) piercing damage.',
            order: 7
        },
        {
            id: S.featureId(268, 8),
            label: 'Tail',
            description: 'Tail. Melee Weapon Attack: +19 to hit, reach 20 ft., one target. Hit: 24 (4d6 + 10) bludgeoning damage, and the target must succeed on a Strength saving throw or be knocked prone.',
            order: 8
        },
        {
            id: S.featureId(268, 9),
            label: 'Frightful Presence',
            description: 'Frightful Presence. Each creature of the tarrasque’s choice within 120 feet of it and aware of it must succeed on a Wisdom saving throw or become frightened for 1 minute.',
            order: 9
        },
        {
            id: S.featureId(268, 10),
            label: 'Swallow',
            description: 'Swallow. The tarrasque can swallow a creature it is grappling. A swallowed creature is blinded and restrained, has total cover, and takes acid damage at the start of each of the tarrasque’s turns.',
            order: 10
        }
    ]
};


