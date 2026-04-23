import { describe, expect, it } from 'vitest';
import type { FeatureAuthored } from '#authored';
import { AUTHORING_MODE_KIND, AUTHORING_SELECTION_KIND, ACTIVATION_CODE, DAMAGE_VALUE_KIND, CHARGE_RESET_KIND, EFFECT_KIND, GRANT_KIND, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, PATH_ROLL_TABLE_KIND, FORCED_MOVEMENT_ACTION_ECONOMY, FORCED_MOVEMENT_DIRECTION, RANGE_KIND, NUMERIC_EXPR_CODE, SIZE_CODE, SCALING, SCALING_SOURCE, TRIGGER } from '#core';
import { compileCharge, compileDamageEffect, compileEffectResult, compileFeatGrant, compileFeatGrantResult, compileFeatureResult, compileScalingSource, compileSpellGrant } from '#compilers';
describe('shared compiler scaling', () => {
    it('compiles scaling sources with their required payload', () => {
        expect(compileScalingSource({
            scalingSource: SCALING_SOURCE.CLASS_LEVEL,
            classId: 'wizard'
        })).toEqual({
            scalingSource: SCALING_SOURCE.CLASS_LEVEL,
            classId: 'wizard'
        });
        expect(compileScalingSource({
            scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL
        })).toEqual({
            scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL
        });
    });
    it('compiles per-level fixed charge progressions without flattening levels', () => {
        const compiled = compileCharge({
            id: 'arcane-recovery-uses',
            limitKind: 'FIXED_AMOUNT',
            scalingKind: SCALING.PER_LEVEL,
            resetKind: CHARGE_RESET_KIND.LONG_REST,
            levels: [
                {
                    id: 'charge-level-1',
                    level: 1,
                    amount: 1
                },
                {
                    id: 'charge-level-5',
                    level: 5,
                    amount: 2
                }
            ]
        });
        expect(compiled).toEqual({
            id: 'arcane-recovery-uses',
            limitKind: 'FIXED_AMOUNT',
            scalingKind: SCALING.PER_LEVEL,
            resetKind: CHARGE_RESET_KIND.LONG_REST,
            bonuses: undefined,
            levels: [
                {
                    id: 'charge-level-1',
                    level: 1,
                    amount: 1
                },
                {
                    id: 'charge-level-5',
                    level: 5,
                    amount: 2
                }
            ]
        });
    });
    it('returns a compile result and preserves nested spell-grant scaling on features', () => {
        const authored = {
            id: 'wizard-spell-progression',
            label: 'Wizard Spell Progression',
            description: 'Baseline SRD spell access with room for homebrew progression.',
            order: 1,
            grants: {
                spells: [
                    {
                        grantKind: GRANT_KIND.SPELL_GRANT,
                        id: 'wizard-spells',
                        order: 1,
                        selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                        scalingKind: SCALING.PER_LEVEL,
                        progression: {
                            scalingSource: SCALING_SOURCE.CLASS_LEVEL,
                            classId: 'wizard',
                            levels: [
                                {
                                    id: 'wizard-spells-1',
                                    level: 1,
                                    order: 1,
                                    count: 2,
                                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                                    spellIds: ['magic-missile', 'shield']
                                },
                                {
                                    id: 'wizard-spells-3',
                                    level: 3,
                                    order: 2,
                                    count: 1,
                                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                                    spellIds: ['misty-step']
                                }
                            ]
                        }
                    }
                ]
            }
        } satisfies FeatureAuthored;
        const result = compileFeatureResult(authored);
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error('Expected compileFeatureResult to succeed');
        }
        expect(result.diagnostics).toEqual([]);
        expect(result.value.id).toBe('wizard-spell-progression');
        expect(result.value.spells).toHaveLength(1);
        expect(result.value.spells?.[0]).toMatchObject({
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.PER_LEVEL,
            scalingSource: SCALING_SOURCE.CLASS_LEVEL,
            classId: 'wizard',
            levels: [
                {
                    id: 'wizard-spells-1',
                    level: 1,
                    count: 2,
                    order: 1,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    spellIds: ['magic-missile', 'shield']
                },
                {
                    id: 'wizard-spells-3',
                    level: 3,
                    count: 1,
                    order: 2,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    spellIds: ['misty-step']
                }
            ]
        });
    });
    it('preserves spell grant restrictions and filters in the compiled grant shape', () => {
        const compiled = compileSpellGrant({
            grantKind: GRANT_KIND.SPELL_GRANT,
            id: 'circle-spells-arctic',
            order: 1,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.PER_LEVEL,
            progression: {
                scalingSource: SCALING_SOURCE.CLASS_LEVEL,
                classId: 'druid',
                levels: [
                    {
                        id: 'circle-spells-3',
                        level: 3,
                        order: 1,
                        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                        spellIds: ['spike-growth']
                    }
                ]
            },
            restrictions: {
                groups: [
                    {
                        contexts: [
                            {
                                subject: 'SUBCLASS',
                                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                                conditions: [
                                    {
                                        predicateCode: 'SUBCLASS_SPECIALIZATION',
                                        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                                        specializationIds: ['arctic']
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            filters: {
                groups: [
                    {
                        contexts: [
                            {
                                subject: 'SPELL',
                                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                                conditions: [
                                    {
                                        predicateCode: 'SPELL_LEVEL',
                                        min: 2
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        } as never);
        expect(compiled).toMatchObject({
            grantKind: GRANT_KIND.SPELL_GRANT,
            restrictions: {
                groups: [
                    {
                        contexts: [
                            {
                                subject: 'SUBCLASS',
                                conditions: [
                                    {
                                        predicateCode: 'SUBCLASS_SPECIALIZATION',
                                        specializationIds: ['arctic']
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            filters: {
                groups: [
                    {
                        contexts: [
                            {
                                subject: 'SPELL',
                                conditions: [
                                    {
                                        predicateCode: 'SPELL_LEVEL',
                                        min: 2
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        });
    });
    it('compiles spell-level damage scaling into discrete compiled outcomes', () => {
        const compiled = compileDamageEffect({
            id: 'burning-hands-upcast',
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: 'fire',
            valueKind: DAMAGE_VALUE_KIND.DICE,
            scalingKind: SCALING.PER_LEVEL,
            scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
            levels: [
                {
                    id: 'burning-hands-1',
                    level: 1,
                    order: 1,
                    diceConfig: '3d6'
                },
                {
                    id: 'burning-hands-2',
                    level: 2,
                    order: 2,
                    diceConfig: '4d6'
                },
                {
                    id: 'burning-hands-3',
                    level: 3,
                    order: 3,
                    diceConfig: '5d6'
                }
            ]
        });
        expect(compiled).toEqual([
            {
                id: 'burning-hands-1',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: 'fire',
                valueKind: DAMAGE_VALUE_KIND.DICE,
                level: 1,
                order: 1,
                dice: '3d6',
                bonuses: undefined,
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL
            },
            {
                id: 'burning-hands-2',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: 'fire',
                valueKind: DAMAGE_VALUE_KIND.DICE,
                level: 2,
                order: 2,
                dice: '4d6',
                bonuses: undefined,
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL
            },
            {
                id: 'burning-hands-3',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: 'fire',
                valueKind: DAMAGE_VALUE_KIND.DICE,
                level: 3,
                order: 3,
                dice: '5d6',
                bonuses: undefined,
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL
            }
        ]);
    });
    it('preserves class-level chosen feat grant progression for SRD-style feature gates', () => {
        const compiled = compileFeatGrant({
            grantKind: GRANT_KIND.FEAT_GRANT,
            id: 'fighting-style-progression',
            order: 1,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.PER_LEVEL,
            progression: {
                scalingSource: SCALING_SOURCE.CLASS_LEVEL,
                classId: 'fighter',
                levels: [
                    {
                        id: 'fighting-style-1',
                        level: 1,
                        order: 1,
                        count: 1,
                        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                        featIds: ['archery', 'defense']
                    },
                    {
                        id: 'fighting-style-10',
                        level: 10,
                        order: 2,
                        count: 1,
                        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                        featIds: ['superior-technique']
                    }
                ]
            }
        });
        expect(compiled).toEqual({
            grantKind: GRANT_KIND.FEAT_GRANT,
            id: 'fighting-style-progression',
            order: 1,
            charges: undefined,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.PER_LEVEL,
            scalingSource: SCALING_SOURCE.CLASS_LEVEL,
            classId: 'fighter',
            levels: [
                {
                    id: 'fighting-style-1',
                    level: 1,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    featIds: ['archery', 'defense'],
                    order: 1,
                    count: 1
                },
                {
                    id: 'fighting-style-10',
                    level: 10,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    featIds: ['superior-technique'],
                    order: 2,
                    count: 1
                }
            ]
        });
    });
    it('exposes grant compiler result wrappers without breaking current grant compilers', () => {
        const result = compileFeatGrantResult({
            grantKind: GRANT_KIND.FEAT_GRANT,
            id: 'bonus-feat',
            order: 1,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            featIds: ['alert']
        });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error('Expected compileFeatGrantResult to succeed');
        }
        expect(result.diagnostics).toEqual([]);
        expect(result.value).toEqual(compileFeatGrant({
            grantKind: GRANT_KIND.FEAT_GRANT,
            id: 'bonus-feat',
            order: 1,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            featIds: ['alert']
        }));
    });
    it('preserves explicit ALL grant authoring mode in compiled grant output', () => {
        const compiled = compileFeatGrant({
            grantKind: GRANT_KIND.FEAT_GRANT,
            id: 'explicit-all-bonus-feat',
            order: 1,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            charges: undefined,
            authoringModeKind: AUTHORING_MODE_KIND.ALL
        });
        expect(compiled).toEqual({
            grantKind: GRANT_KIND.FEAT_GRANT,
            id: 'explicit-all-bonus-feat',
            order: 1,
            charges: undefined,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.ALL
        });
    });
    it('compiles exact roll-table condition paths through the effect result wrapper', () => {
        const result = compileEffectResult({
            id: 'potion-side-effects',
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ENTER_AREA,
                activation: { code: ACTIVATION_CODE.FREE },
                range: {
                    id: 'self-range',
                    rangeKind: RANGE_KIND.SELF
                }
            },
            paths: [
                {
                    id: 'potion-side-effects-table',
                    order: 1,
                    pathCode: PATH_CODE.PASSIVE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "ROLL_TABLE" as const,
                    dieConfig: 'd6',
                    rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
                    rows: [
                        {
                            id: 'slowed',
                            order: 1,
                            rollValue: 1,
                            resultBlock: {
                                id: "slowed__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: 'slowed',
                                        effectKind: EFFECT_KIND.CONDITION,
                                        conditionId: 'slowed'
                                    }
                                ]
                            }
                        },
                        {
                            id: 'poisoned',
                            order: 2,
                            rollValue: 2,
                            resultBlock: {
                                id: "poisoned__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: 'poisoned',
                                        effectKind: EFFECT_KIND.CONDITION,
                                        conditionId: 'poisoned'
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error('Expected compileEffectResult to succeed');
        }
        expect(result.diagnostics).toEqual([]);
        expect(result.value).toEqual([
            {
                id: 'slowed',
                entryId: 'slowed',
                pathGroupId: 'potion-side-effects-table',
                pathCode: PATH_CODE.PASSIVE,
                pathOrder: 1,
                entryOrder: 1000,
                resolutionKind: PATH_RESOLUTION_KIND.ROLL_TABLE,
                groupKind: PATH_GROUP_TYPE.SINGLE,
                rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
                die: 'd6',
                rollValue: 1,
                outcome: {
                    id: 'slowed',
                    effectKind: EFFECT_KIND.CONDITION,
                    conditionId: 'slowed'
                }
            },
            {
                id: 'poisoned',
                entryId: 'poisoned',
                pathGroupId: 'potion-side-effects-table',
                pathCode: PATH_CODE.PASSIVE,
                pathOrder: 1,
                entryOrder: 2000,
                resolutionKind: PATH_RESOLUTION_KIND.ROLL_TABLE,
                groupKind: PATH_GROUP_TYPE.SINGLE,
                rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
                die: 'd6',
                rollValue: 2,
                outcome: {
                    id: 'poisoned',
                    effectKind: EFFECT_KIND.CONDITION,
                    conditionId: 'poisoned'
                }
            }
        ]);
    });
    it('compiles non-damage effect outcomes like apply-grant and rule without flattening them away', () => {
        const result = compileEffectResult({
            id: 'shield-effect',
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SPELL_ATTACK,
                activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
                range: {
                    id: 'shield-self',
                    rangeKind: RANGE_KIND.SELF
                }
            },
            paths: [
                {
                    id: 'shield-buff',
                    order: 1,
                    pathCode: PATH_CODE.ON_CAST,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: "shield-buff__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: 'shield-buff',
                                effectKind: EFFECT_KIND.APPLY_GRANT,
                                grants: {
                                    modifiers: [
                                        {
                                            grantKind: GRANT_KIND.MODIFIER_GRANT,
                                            id: 'shield-ac',
                                            order: 1,
                                            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                                            valueDomainCode: 'ARMOR_CLASS',
                                            domain: {},
                                            modifierKind: 'BONUS',
                                            scope: 'GLOBAL',
                                            payload: {
                                                valueKind: 'FIXED',
                                                amount: 5
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                },
                {
                    id: 'shield-rule',
                    order: 2,
                    pathCode: PATH_CODE.ON_CAST,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: "shield-rule__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: 'shield-rule',
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                }
            ]
        });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error('Expected compileEffectResult to succeed');
        }
        expect(result.value).toEqual([
            {
                id: 'shield-buff',
                entryId: 'shield-buff',
                pathGroupId: 'shield-buff',
                pathCode: PATH_CODE.ON_CAST,
                pathOrder: 1,
                entryOrder: 1,
                resolutionKind: PATH_RESOLUTION_KIND.DIRECT,
                groupKind: PATH_GROUP_TYPE.SINGLE,
                outcome: {
                    id: 'shield-buff',
                    effectKind: EFFECT_KIND.APPLY_GRANT,
                    grants: {
                        modifiers: [
                            {
                                grantKind: GRANT_KIND.MODIFIER_GRANT,
                                id: 'shield-ac',
                                order: 1,
                                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                                valueDomainCode: 'ARMOR_CLASS',
                                domain: {},
                                modifierKind: 'BONUS',
                                scope: 'GLOBAL',
                                payload: {
                                    valueKind: 'FIXED',
                                    amount: 5
                                }
                            }
                        ]
                    }
                },
                duration: undefined
            },
            {
                id: 'shield-rule',
                entryId: 'shield-rule',
                pathGroupId: 'shield-rule',
                pathCode: PATH_CODE.ON_CAST,
                pathOrder: 2,
                entryOrder: 1,
                resolutionKind: PATH_RESOLUTION_KIND.DIRECT,
                groupKind: PATH_GROUP_TYPE.SINGLE,
                outcome: {
                    id: 'shield-rule',
                    effectKind: EFFECT_KIND.RULE
                },
                duration: undefined
            }
        ]);
    });
    it('preserves activated on-use healing effects with structured heal bonuses', () => {
        const result = compileEffectResult({
            id: 'second-wind-effect',
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 },
                range: {
                    id: 'second-wind-range',
                    rangeKind: RANGE_KIND.SELF
                },
                targeting: {
                    selectionKind: 'SELF'
                }
            },
            paths: [
                {
                    id: 'second-wind-heal',
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: "second-wind-heal__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: 'second-wind-heal',
                                effectKind: EFFECT_KIND.HEAL,
                                valueKind: 'DICE',
                                scalingKind: SCALING.NONE,
                                diceConfig: '1d10',
                                bonuses: [
                                    {
                                        id: 'second-wind-fighter-level',
                                        bonusKind: 'CLASS_LEVEL',
                                        classId: 'fighter',
                                        order: 1
                                    }
                                ]
                            }
                        ]
                    }
                }
            ]
        });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error('Expected compileEffectResult to succeed');
        }
        expect(result.value[0]).toMatchObject({
            pathCode: PATH_CODE.ON_USE,
            outcome: {
                effectKind: EFFECT_KIND.HEAL,
                bonuses: [
                    {
                        bonusKind: 'CLASS_LEVEL',
                        classId: 'fighter'
                    }
                ]
            }
        });
    });
    it('compiles optional labels and descriptions onto flattened path summaries', () => {
        const result = compileEffectResult({
            id: 'choice-copy-effect',
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SPELL_ATTACK,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: 'choice-copy-range',
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 30,
                    unit: 'FEET'
                }
            },
            paths: [
                {
                    id: 'choice-copy-direct',
                    order: 1,
                    pathCode: PATH_CODE.ON_HIT,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: "choice-copy-direct__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: 'choice-copy-direct-entry',
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                },
                {
                    id: 'choice-copy-roll',
                    order: 2,
                    pathCode: PATH_CODE.ON_HIT,
                    groupType: PATH_GROUP_TYPE.CHOICE,
                    selectionKind: "ROLL_TABLE" as const,
                    dieConfig: '1d4',
                    rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
                    rows: [
                        {
                            id: 'choice-copy-roll-entry',
                            order: 1,
                            rollValue: 1,
                            resultBlock: {
                                id: "choice-copy-roll-entry__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: 'choice-copy-roll-entry',
                                        effectKind: EFFECT_KIND.RULE
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error('Expected compileEffectResult to succeed');
        }
        expect(result.value).toEqual([
            {
                id: 'choice-copy-direct-entry',
                entryId: 'choice-copy-direct-entry',
                pathGroupId: 'choice-copy-direct',
                pathCode: PATH_CODE.ON_HIT,
                pathOrder: 1,
                entryOrder: 1,
                resolutionKind: PATH_RESOLUTION_KIND.DIRECT,
                groupKind: PATH_GROUP_TYPE.SINGLE,
                outcome: {
                    id: 'choice-copy-direct-entry',
                    effectKind: EFFECT_KIND.RULE
                }
            },
            {
                id: 'choice-copy-roll-entry',
                entryId: 'choice-copy-roll-entry',
                pathGroupId: 'choice-copy-roll',
                pathCode: PATH_CODE.ON_HIT,
                pathOrder: 2,
                entryOrder: 1000,
                resolutionKind: PATH_RESOLUTION_KIND.ROLL_TABLE,
                groupKind: PATH_GROUP_TYPE.SINGLE,
                die: '1d4',
                rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
                rollValue: 1,
                outcome: {
                    id: 'choice-copy-roll-entry',
                    effectKind: EFFECT_KIND.RULE
                }
            }
        ]);
    });
    it('compiles long-cast manifest effects with separate activation and casting layers', () => {
        const result = compileEffectResult({
            id: 'find-familiar-effect',
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
                range: {
                    id: 'find-familiar-range',
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 10,
                    unit: 'FEET'
                },
                targeting: {
                    selectionKind: 'AREA_CONTENTS'
                }
            },
            paths: [
                {
                    id: 'find-familiar-path',
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: "find-familiar-path__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: 'find-familiar-duration',
                            durationKind: 'UNTIL_DISPELLED'
                        },
                        outcomes: [
                            {
                                id: 'find-familiar-path',
                                effectKind: EFFECT_KIND.MANIFEST,
                                manifestKind: 'CREATURE'
                            }
                        ]
                    }
                }
            ]
        });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error('Expected compileEffectResult to succeed');
        }
        expect(result.value[0]).toMatchObject({
            pathCode: PATH_CODE.ON_USE,
            outcome: {
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: 'CREATURE'
            }
        });
    });
    it('preserves summon stat block payloads on manifested outcomes', () => {
        const result = compileEffectResult({
            id: 'arcane-hand-effect',
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
                range: {
                    id: 'arcane-hand-range',
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 120,
                    unit: 'FEET'
                }
            },
            paths: [
                {
                    id: 'arcane-hand-path',
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: "arcane-hand-path__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: 'arcane-hand-entry',
                                effectKind: EFFECT_KIND.MANIFEST,
                                manifestKind: 'SUMMON',
                                statBlock: {
                                    size: SIZE_CODE.LARGE,
                                    armorClass: {
                                        kind: NUMERIC_EXPR_CODE.FIXED,
                                        value: 20
                                    },
                                    hitPoints: {
                                        kind: NUMERIC_EXPR_CODE.HIT_POINT_MAXIMUM
                                    },
                                    speeds: [
                                        {
                                            speedId: 'arcane-hand-speed',
                                            amount: 60,
                                            unit: 'FEET'
                                        }
                                    ],
                                    abilityScores: {
                                        STRENGTH: {
                                            kind: NUMERIC_EXPR_CODE.FIXED,
                                            value: 26
                                        }
                                    },
                                    damageabilityKind: 'INVULNERABLE',
                                    occupiesSpace: true
                                }
                            }
                        ]
                    }
                }
            ]
        });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error('Expected compileEffectResult to succeed');
        }
        expect(result.value[0]).toMatchObject({
            outcome: {
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: 'SUMMON',
                statBlock: {
                    size: SIZE_CODE.LARGE,
                    armorClass: {
                        kind: NUMERIC_EXPR_CODE.FIXED,
                        value: 20
                    },
                    hitPoints: {
                        kind: NUMERIC_EXPR_CODE.HIT_POINT_MAXIMUM
                    },
                    speeds: [
                        {
                            speedId: 'arcane-hand-speed',
                            amount: 60,
                            unit: 'FEET'
                        }
                    ],
                    abilityScores: {
                        STRENGTH: {
                            kind: NUMERIC_EXPR_CODE.FIXED,
                            value: 26
                        }
                    },
                    damageabilityKind: 'INVULNERABLE',
                    occupiesSpace: true
                }
            }
        });
    });
    it('preserves lifecycle metadata and typed forced movement outcomes', () => {
        const result = compileEffectResult({
            id: 'dissonant-whispers-effect',
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SAVING_THROW,
                savingThrow: {
                    id: 'dw-save',
                    savingThrowKind: 'FIXED_VALUE',
                    ability: 'WISDOM',
                    dc: 14
                },
                activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
                range: {
                    id: 'dw-range',
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 60,
                    unit: 'FEET'
                }
            },
            paths: [
                {
                    id: 'dw-forced-movement',
                    order: 1,
                    pathCode: PATH_CODE.ON_SAVE_FAIL,
                    groupType: PATH_GROUP_TYPE.SEQUENTIAL,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: "dw-forced-movement__result",
                        resultKind: "SEQUENCE" as const,
                        lifecycle: {
                            recurringKind: 'NONE',
                            consumeOnFirstEvent: 'ON_ATTACK_ROLL',
                            endOnEvents: ['ON_CAST_SPELL']
                        },
                        outcomes: [
                            {
                                id: 'dw-forced-movement',
                                effectKind: EFFECT_KIND.FORCED_MOVEMENT,
                                direction: FORCED_MOVEMENT_DIRECTION.AWAY_FROM_SOURCE,
                                distanceMode: 'UP_TO_SPEED',
                                actionEconomy: FORCED_MOVEMENT_ACTION_ECONOMY.REACTION
                            }
                        ]
                    }
                }
            ]
        });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error('Expected compileEffectResult to succeed');
        }
        expect(result.value[0]).toMatchObject({
            pathCode: PATH_CODE.ON_SAVE_FAIL,
            lifecycle: {
                recurringKind: 'NONE',
                consumeOnFirstEvent: 'ON_ATTACK_ROLL',
                endOnEvents: ['ON_CAST_SPELL']
            },
            outcome: {
                effectKind: EFFECT_KIND.FORCED_MOVEMENT,
                direction: FORCED_MOVEMENT_DIRECTION.AWAY_FROM_SOURCE,
                distanceMode: 'UP_TO_SPEED',
                actionEconomy: FORCED_MOVEMENT_ACTION_ECONOMY.REACTION
            }
        });
    });
});



