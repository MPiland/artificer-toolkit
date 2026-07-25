import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const shadow: CreatureAuthored = {
    id: S.CREATURE_IDS.SHADOW,
    label: 'Shadow',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.UNDEAD,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000900000000',
    abilityScores: {
        STRENGTH: 6,
        DEXTERITY: 14,
        CONSTITUTION: 13,
        INTELLIGENCE: 6,
        WISDOM: 10,
        CHARISMA: 8,
    },
    armorClass: 12,
    hitPoints: 16,
    hitDice: {
      count: 3,
      die: 8,
      modifier: 3,
    },
    speeds: [...S.walk(40)],
    proficiencies: [
        S.grantedSkillProficiency(7360, 1, 'STEALTH')
    ],
    damageResistances: ['acid', 'cold', 'fire', 'lightning', 'thunder'],
    damageImmunities: ['necrotic', 'poison'],
    conditionImmunities: ['exhaustion', 'frightened', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained'],
    senses: ['darkvision 60 ft.'],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_1_2,
    xp: 100,
    features: [
        {
            id: S.featureId(250, 1),
            label: 'Amorphous',
            description: 'Amorphous. The shadow can move through a space as narrow as 1 inch wide without squeezing.',
            order: 1
        },
        {
            id: S.featureId(250, 2),
            label: 'Shadow Stealth',
            description: 'Shadow Stealth. While in dim light or darkness, the shadow can take the Hide action as a bonus action.',
            order: 2
        },
        {
            id: S.featureId(250, 3),
            label: 'Strength Drain',
            description: 'Strength Drain. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 9 (2d6 + 2) necrotic damage, and the target’s Strength score is reduced. If this reduces the target to 0, the target dies and a new shadow rises from the corpse.',
            effects: [
                {
                    id: S.actionId(7360, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(7360, 2),
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
                            id: S.actionId(7360, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7360, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7360, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('NECROTIC'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6+2'
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
};


