import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const wereboar: CreatureAuthored = {
    id: S.CREATURE_IDS.WEREBOAR,
    label: 'Wereboar',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.HUMANOID,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000800000000',
    tags: ['human', 'shapechanger'],
    abilityScores: {
        STRENGTH: 17,
        DEXTERITY: 10,
        CONSTITUTION: 15,
        INTELLIGENCE: 10,
        WISDOM: 9,
        CHARISMA: 8,
        SPELLCASTING: 0
    },
    armorClass: 10,
    hitPoints: 78,
    hitDice: '12d8+24',
    speeds: [...S.walk(30)],
    damageImmunities: ['bludgeoning, piercing, and slashing from nonmagical attacks not made with silvered weapons'],
    passivePerception: 9,
    challengeRatingId: S.CR.CR_4,
    xp: 1100,
    features: [
        {
            id: S.featureId(288, 1),
            label: 'Shapechanger',
            description: 'Shapechanger. The wereboar can use its action to polymorph into a boar-humanoid hybrid or into a boar, or back into its true form, which is humanoid.',
            order: 1
        },
        {
            id: S.featureId(288, 2),
            label: 'Charge',
            description: 'Charge. If the wereboar moves at least 15 feet straight toward a target and then hits it with a melee attack on the same turn, the target takes extra damage.',
            order: 2
        },
        {
            id: S.featureId(288, 3),
            label: 'Relentless',
            description: 'Relentless. If the wereboar takes damage that would reduce it to 0 hit points, it makes a Constitution saving throw to drop to 1 hit point instead.',
            order: 3
        },
        {
            id: S.featureId(288, 4),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 12 (2d6 + 5) piercing damage.',
            effects: [
                {
                    id: S.actionId(6929, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(6929, 2),
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
                            id: S.actionId(6929, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(6929, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(6929, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6+5'
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
            id: S.featureId(288, 5),
            label: 'Maul',
            description: 'Maul. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage.',
            order: 5
        }
    ]
};


