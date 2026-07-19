import { ACTIVATION_CODE, AUTHORING_SELECTION_KIND, PATH_CODE, PATH_GROUP_TYPE, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, GRANT_KIND, MEASUREMENT_UNIT_CODE, MODIFIER_KIND, MODIFIER_SCOPE_KIND, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, VALUE_DOMAIN_CODE, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const shieldOfFaith: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.SHIELD_OF_FAITH,
    label: 'Shield of Faith',
    description: 'A shimmering field appears and surrounds a creature of your choice within range, granting it a +2 bonus to AC for the duration.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 1,
    classIds: [CLASS_IDS.CLERIC, CLASS_IDS.PALADIN],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "a small parchment with a bit of holy text written on it",
    magicSchoolId: schoolId('ABJURATION'),
    attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
    effects: [
        {
            id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x210, 1),
            order: 1,
            invocation: {
                kind: 'ACTION' as const,
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.BONUS_ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 60,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    originKind: 'SOURCE' as const,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x213, 1),
                            durationKind: DURATION_KIND.MINUTE,
                            amount: 10
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x212, 1),
                                effectKind: EFFECT_KIND.APPLY_GRANT,
                                grants: {
                                    modifiers: [
                                        {
                                            id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x214, 1),
                                            grantKind: GRANT_KIND.MODIFIER_GRANT,
                                            valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                                            domain: {},
                                            modifierKind: MODIFIER_KIND.BONUS,
                                            scope: MODIFIER_SCOPE_KIND.GLOBAL,
                                            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                                            payload: {
                                                valueKind: 'FIXED',
                                                amount: 2
                                            },
                                            order: 1
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            ]
        }
    ],
    userId: SRD_USER_ID,
    systemId: SRD_SYSTEM_ID
};

