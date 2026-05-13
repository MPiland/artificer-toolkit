import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const werebear: CreatureAuthored = {
    id: S.CREATURE_IDS.WEREBEAR,
    label: 'Werebear',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.HUMANOID,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000200000000',
    tags: ['human', 'shapechanger'],
    abilityScores: {
        STRENGTH: 19,
        DEXTERITY: 10,
        CONSTITUTION: 17,
        INTELLIGENCE: 11,
        WISDOM: 12,
        CHARISMA: 12,
        SPELLCASTING: 0
    },
    armorClass: 11,
    hitPoints: 135,
    hitDice: '18d8+54',
    speeds: [...S.walk(30)],
    damageImmunities: ['bludgeoning, piercing, and slashing from nonmagical attacks not made with silvered weapons'],
    proficiencies: [
        S.grantedSkillProficiency(7539, 1, 'PERCEPTION')
    ],
    passivePerception: 17,
    challengeRatingId: S.CR.CR_5,
    xp: 1800,
    features: [
        {
            id: S.featureId(287, 1),
            label: 'Shapechanger',
            description: 'Shapechanger. The werebear can use its action to polymorph into a bear-humanoid hybrid or into a bear, or back into its true form, which is humanoid.',
            order: 1
        },
        {
            id: S.featureId(287, 2),
            label: 'Keen Smell',
            description: 'Keen Smell. The werebear has advantage on Wisdom (Perception) checks that rely on smell.',
            order: 2
        },
        {
            id: S.featureId(287, 3),
            label: 'Multiattack',
            description: 'Multiattack. The werebear makes two attacks: one with its bite and one with its claws, or one with its bite and one with a weapon.',
            order: 3
        },
        {
            id: S.featureId(287, 4),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 15 (2d10 + 4) piercing damage.',
            order: 4
        },
        {
            id: S.featureId(287, 5),
            label: 'Claws',
            description: 'Claws. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) slashing damage.',
            effects: [
                {
                    id: S.actionId(7539, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(7539, 2),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 5,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(7539, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7539, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7539, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8+4'
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
            id: S.featureId(287, 6),
            label: 'Curse of Lycanthropy',
            description: 'Curse of Lycanthropy. A humanoid hit by the werebear’s bite must succeed on a Constitution saving throw or be cursed with werebear lycanthropy.',
            order: 6
        }
    ]
};


