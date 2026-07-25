import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const lich: CreatureAuthored = {
    id: S.CREATURE_IDS.LICH,
    label: 'Lich',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.UNDEAD,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000700000000',
    abilityScores: {
        STRENGTH: 11,
        DEXTERITY: 16,
        CONSTITUTION: 16,
        INTELLIGENCE: 20,
        WISDOM: 14,
        CHARISMA: 16,
    },
    armorClass: 17,
    armorClassNote: 'natural armor',
    hitPoints: 135,
    hitDice: {
      count: 18,
      die: 8,
      modifier: 54,
    },
    speeds: [...S.walk(30)],
    proficiencies: [
        S.grantedSaveProficiency(2794, 1, 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM'),
        S.grantedSkillProficiency(2794, 2, 'ARCANA', 'HISTORY', 'INSIGHT', 'PERCEPTION'),
        S.grantedLanguageProficiency(2794, 3, 'COMMON', 'DRACONIC', 'ELVISH', 'GIANT', 'INFERNAL')
    ],
    damageResistances: ['cold', 'lightning', 'necrotic', 'bludgeoning, piercing, and slashing from nonmagical attacks'],
    damageImmunities: ['poison'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
    senses: ['truesight 120 ft.'],
    passivePerception: 14,
    challengeRatingId: S.CR.CR_21,
    xp: 33000,
    features: [
        {
            id: S.featureId(183, 1),
            label: 'Legendary Resistance (3/Day)',
            description: 'Legendary Resistance (3/Day). If the lich fails a saving throw, it can choose to succeed instead.',
            attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
            charges: {
                id: S.legendaryActionId(2794, 20),
                limitKind: 'FIXED_AMOUNT',
                scalingKind: S.SCALING.NONE,
                resetKind: S.CHARGE_RESET_KIND.MANUAL,
                amount: 3
            },
            order: 1
        },
        {
            id: S.featureId(183, 2),
            label: 'Rejuvenation',
            description: 'Rejuvenation. If it has a phylactery, a destroyed lich gains a new body in 1d10 days, regaining all its hit points and becoming active again.',
            order: 2
        },
        {
            id: S.featureId(183, 3),
            label: 'Spellcasting',
            description: 'Spellcasting. The lich is an 18th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 20, +12 to hit with spell attacks). It requires no material components and has the following wizard spells prepared: Cantrips (at will): mage hand, prestidigitation, ray of frost, shocking grasp. 1st level (4 slots): detect magic, magic missile, shield, thunderwave. 2nd level (3 slots): blindness/deafness, invisibility, mirror image. 3rd level (3 slots): animate dead, counterspell, dispel magic, fireball. 4th level (3 slots): blight, dimension door, phantasmal killer. 5th level (3 slots): cloudkill, geas. 6th level (1 slot): disintegrate, globe of invulnerability. 7th level (1 slot): finger of death, plane shift. 8th level (1 slot): dominate monster, power word stun. 9th level (1 slot): power word kill.',
            order: 3
        },
        {
            id: S.featureId(183, 4),
            label: 'Turn Resistance',
            description: 'Turn Resistance. The lich has advantage on saving throws against any effect that turns undead.',
            order: 4
        },
        {
            id: S.featureId(183, 5),
            label: 'Paralyzing Touch',
            description: 'Paralyzing Touch. Melee Spell Attack: +12 to hit, reach 5 ft., one creature. Hit: 10 (3d6) cold damage, and the target must succeed on a DC 18 Constitution saving throw or be paralyzed for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
            effects: [
                {
                    id: S.actionId(2794, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.SPELL_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(2794, 2),
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
                            id: S.actionId(2794, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(2794, 3) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(2794, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('COLD'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d6'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(2794, 4),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(2794, 4) + "__result",
                                resultKind: "SINGLE" as const,
                                duration: {
                                    id: S.actionId(2794, 5),
                                    durationKind: DURATION_KIND.MINUTE,
                                    amount: 1
                                },
                                outcomes: [
                                    {
                                        id: S.actionId(2794, 4),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('PARALYZED')
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
            id: S.featureId(183, 6),
            label: 'Legendary Actions',
            section: 'LEGENDARY_ACTION',
            description: 'The lich can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature\'s turn. The lich regains spent legendary actions at the start of its turn.',
            attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
            charges: {
                id: S.legendaryActionId(2794, 21),
                limitKind: 'FIXED_AMOUNT',
                scalingKind: S.SCALING.NONE,
                resetKind: S.CHARGE_RESET_KIND.MANUAL,
                amount: 3
            },
            order: 6
        }
    ]
};


