import { describe, expect, it } from 'vitest';
import { createFeatRepository } from '../repositories/index.js';
import { InMemoryDb } from './helpers/in-memory-db.js';
type RowMap = Record<string, unknown[]>;
function createFakeDb(rowsByTable: RowMap) {
    return {
        selectFrom(table: string) {
            const state = {
                filtered: [...(rowsByTable[table] ?? [])]
            };
            const builder = {
                select() {
                    return builder;
                },
                where(column: string, _op: string, value: string | string[]) {
                    state.filtered = state.filtered.filter((row) => {
                        const record = row as Record<string, unknown>;
                        if (_op === 'in') {
                            return Array.isArray(value) && value.includes(record[column] as string);
                        }
                        return record[column] === value;
                    });
                    return builder;
                },
                orderBy(column: string) {
                    state.filtered = [...state.filtered].sort((left, right) => {
                        const leftValue = (left as Record<string, number | string>)[column];
                        const rightValue = (right as Record<string, number | string>)[column];
                        return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
                    });
                    return builder;
                },
                async execute() {
                    return state.filtered;
                },
                async executeTakeFirst() {
                    return state.filtered[0] ?? undefined;
                }
            };
            return builder;
        }
    };
}
describe('createFeatRepository', () => {
    it('hydrates a feat with supported owned charge and grant links', async () => {
        const repository = createFeatRepository(createFakeDb({
            feats: [
                {
                    id: 'feat-1',
                    system_id: 'system-1',
                    user_id: 'user-1',
                    label: 'Arcane Initiate',
                    description: 'Learns a trick.',
                    prerequisite_id: null,
                    charge_id: 'charge-1'
                }
            ],
            charges: [
                { id: 'charge-1', scaling_kind: 'NONE', reset_kind: 'LONG_REST' }
            ],
            charge_limits: [
                {
                    charge_id: 'charge-1',
                    limit_kind: 'FIXED_AMOUNT',
                    class_id: null,
                    amount: 1,
                    multiplier: null,
                    min: null,
                    max: null
                }
            ],
            charge_scaling_levels: [],
            charge_bonuses: [],
            feat_proficiency_grants: [
                { feat_id: 'feat-1', proficiency_grant_id: 'prof-1', sort_order: 2 }
            ],
            feat_sense_grants: [
                { feat_id: 'feat-1', sense_grant_id: 'sense-1', sort_order: 1 }
            ],
            feat_spell_grants: [
                { feat_id: 'feat-1', spell_grant_id: 'spell-1', sort_order: 3 }
            ],
            feat_modifier_grants: [],
            feat_effects: [],
            feat_details: [
                { feat_id: 'feat-1', detail_id: 'feat-detail-1', sort_order: 1 }
            ],
            details: [
                { id: 'feat-detail-1', label: 'Detail', description: 'Once per day.', sort_order: 1 }
            ],
            feat_features: [
                { feat_id: 'feat-1', feature_id: 'feature-1', sort_order: 1 }
            ],
            features: [
                {
                    id: 'feature-1',
                    label: 'Bonus Cantrip',
                    description: 'Learn an extra trick.',
                    charge_id: null,
                    restriction_id: null,
                    sort_order: 1,
                    available_at_level: null
                }
            ],
            feature_effects: [],
            feature_details: [],
            feature_attributes: [],
            feature_feat_grants: [],
            feature_modifier_grants: [],
            feature_proficiency_grants: [],
            feature_sense_grants: [],
            feature_spell_grants: [],
            feature_options: [],
            feature_option_levels: [],
            proficiency_grants: [
                {
                    id: 'prof-1',
                    sort_order: 2,
                    proficiency_kind: 'SKILL',
                    selection_kind: 'GRANTED',
                    authoring_mode_kind: 'SELECTED',
                    count: null,
                    level: 'FULL',
                    rounding: null
                }
            ],
            proficiency_grant_skills: [
                { proficiency_grant_id: 'prof-1', skill_id: 'arcana' }
            ],
            proficiency_grant_save_abilities: [],
            proficiency_grant_languages: [],
            proficiency_grant_equipment: [],
            proficiency_grant_equipment_filters: [],
            proficiency_grant_equipment_filter_properties: [],
            proficiency_grant_equipment_properties: [],
            proficiency_grant_equipment_property_filters: [],
            sense_grants: [
                {
                    id: 'sense-1',
                    sort_order: 1,
                    selection_kind: 'GRANTED',
                    scaling_kind: 'NONE',
                    authoring_mode_kind: 'SELECTED',
                    selection_count: null,
                    scaling_source: null,
                    class_id: null,
                    charge_id: null,
                    restriction_id: null
                }
            ],
            sense_grant_senses: [
                { sense_grant_id: 'sense-1', sense_id: 'darkvision' }
            ],
            sense_grant_scaling_levels: [],
            sense_grant_scaling_level_senses: [],
            spell_grants: [
                {
                    id: 'spell-1',
                    sort_order: 3,
                    selection_kind: 'GRANTED',
                    scaling_kind: 'NONE',
                    authoring_mode_kind: 'SELECTED',
                    selection_count: null,
                    scaling_source: null,
                    class_id: null,
                    charge_id: null,
                    restriction_id: null,
                    filter_id: null,
                    cast_at_level: 1
                }
            ],
            spell_grant_attributes: [
                { spell_grant_id: 'spell-1', attribute_code: 'CAST_AT_LEVEL', sort_order: 1 }
            ],
            spell_grant_spells: [
                { spell_grant_id: 'spell-1', spell_id: 'magic-missile' }
            ],
            spell_grant_scaling_levels: [],
            spell_grant_scaling_level_spells: []
        }) as never);
        await expect(repository.findById('feat-1')).resolves.toEqual({
            id: 'feat-1',
            label: 'Arcane Initiate',
            description: 'Learns a trick.',
            status: 'DRAFT',
            details: [
                {
                    id: 'feat-detail-1',
                    label: 'Detail',
                    description: 'Once per day.',
                    order: 1
                }
            ],
            prerequisites: undefined,
            effects: undefined,
            charges: {
                id: 'charge-1',
                resetKind: 'LONG_REST',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 1,
                bonuses: undefined
            },
            features: [
                {
                    id: 'feature-1',
                    label: 'Bonus Cantrip',
                    description: 'Learn an extra trick.',
                    attributes: undefined,
                    details: undefined,
                    effects: undefined,
                    charges: undefined,
                    grants: undefined,
                    restrictions: undefined,
                    order: 1,
                    availableAtLevel: undefined,
                    section: undefined,
                    optionChoices: undefined,
                    options: undefined
                }
            ],
            grants: {
                feats: undefined,
                modifiers: undefined,
                proficiencies: [
                    {
                        id: 'prof-1',
                        grantKind: 'PROFICIENCY_GRANT',
                        proficiencyKind: 'SKILL',
                        order: 2,
                        selectionKind: 'GRANTED',
                        authoringModeKind: 'SELECTED',
                        scalingKind: 'NONE',
                        selectionDuplicatePolicy: undefined,
                        level: 'FULL',
                        rounding: undefined,
                        count: undefined,
                        skillIds: ['arcana'],
                        restrictions: undefined
                    }
                ],
                senses: [
                    {
                        id: 'sense-1',
                        grantKind: 'SENSE_GRANT',
                        order: 1,
                        selectionKind: 'GRANTED',
                        scalingKind: 'NONE',
                        authoringModeKind: 'SELECTED',
                        selectionDuplicatePolicy: undefined,
                        count: undefined,
                        senseIds: ['darkvision'],
                        charges: undefined,
                        restrictions: undefined
                    }
                ],
                spells: [
                    {
                        id: 'spell-1',
                        grantKind: 'SPELL_GRANT',
                        order: 3,
                        attributes: ['CAST_AT_LEVEL'],
                        selectionKind: 'GRANTED',
                        scalingKind: 'NONE',
                        authoringModeKind: 'SELECTED',
                        selectionDuplicatePolicy: undefined,
                        count: undefined,
                        spellIds: ['magic-missile'],
                        castAtLevel: 1,
                        charges: undefined,
                        filters: undefined,
                        restrictions: undefined
                    }
                ]
            },
            userId: 'user-1',
            systemId: 'system-1'
        });
    });
    it('omits optional feat effect paths when the row graph does not contain them', async () => {
        const repository = createFeatRepository(createFakeDb({
            feats: [
                {
                    id: 'feat-2',
                    system_id: 'system-1',
                    user_id: 'user-1',
                    label: 'Tough',
                    description: 'Hardier than most.',
                    prerequisite_id: null,
                    charge_id: null
                }
            ],
            feat_proficiency_grants: [],
            feat_sense_grants: [],
            feat_spell_grants: [],
            feat_modifier_grants: [],
            feat_details: [],
            feat_effects: [],
            feat_features: []
        }) as never);
        await expect(repository.findById('feat-2')).resolves.toEqual({
            id: 'feat-2',
            label: 'Tough',
            description: 'Hardier than most.',
            status: 'DRAFT',
            details: undefined,
            prerequisites: undefined,
            effects: undefined,
            features: undefined,
            charges: undefined,
            grants: undefined,
            userId: 'user-1',
            systemId: 'system-1'
        });
    });
    it('fails loudly when a linked supported grant row is missing', async () => {
        const repository = createFeatRepository(createFakeDb({
            feats: [
                {
                    id: 'feat-missing-grant',
                    system_id: 'system-1',
                    user_id: 'user-1',
                    label: 'Broken Feat',
                    description: 'Oops.',
                    prerequisite_id: null,
                    charge_id: null
                }
            ],
            feat_proficiency_grants: [
                { feat_id: 'feat-missing-grant', proficiency_grant_id: 'prof-missing', sort_order: 1 }
            ],
            feat_sense_grants: [],
            feat_spell_grants: [],
            feat_modifier_grants: [],
            feat_details: [],
            feat_effects: [],
            feat_features: [],
            proficiency_grants: [],
            proficiency_grant_skills: [],
            proficiency_grant_save_abilities: [],
            proficiency_grant_languages: [],
            proficiency_grant_equipment: [],
            proficiency_grant_equipment_filters: [],
            proficiency_grant_equipment_filter_properties: [],
            proficiency_grant_equipment_properties: [],
            proficiency_grant_equipment_property_filters: []
        }) as never);
        await expect(repository.findById('feat-missing-grant')).rejects.toThrow('missing proficiency grant');
    });
    it('hydrates linked modifier grants as part of feat grants', async () => {
        const repository = createFeatRepository(createFakeDb({
            feats: [
                {
                    id: 'feat-with-modifier',
                    system_id: 'system-1',
                    user_id: 'user-1',
                    label: 'Agile Striker',
                    description: 'Quick on the draw.',
                    prerequisite_id: null,
                    charge_id: null
                }
            ],
            feat_proficiency_grants: [],
            feat_sense_grants: [],
            feat_spell_grants: [],
            feat_details: [],
            feat_modifier_grants: [{ feat_id: 'feat-with-modifier', modifier_grant_id: 'modifier-1', sort_order: 1 }],
            feat_effects: [],
            feat_features: [],
            modifier_grants: [{
                    id: 'modifier-1',
                    sort_order: 1,
                    selection_kind: 'GRANTED',
                    count: null,
                    value_domain_code: 'ATTACK_ROLL',
                    modifier_kind: 'ABILITY_MODIFIER_BONUS',
                    scope: 'SOURCE',
                    restriction_id: null
                }],
            modifier_grant_domain_params: [{
                    modifier_grant_id: 'modifier-1',
                    value_domain_code: 'ATTACK_ROLL',
                    attack_domain_code: 'MELEE',
                    ability_code: null,
                    skill_id: null,
                    speed_id: null,
                    sense_code: null,
                    spell_level: null
                }],
            modifier_grant_payloads: [{
                    modifier_grant_id: 'modifier-1',
                    modifier_kind: 'ABILITY_MODIFIER_BONUS',
                    value_domain_code: 'ATTACK_ROLL',
                    numeric_value_kind: null,
                    numeric_amount: null,
                    numeric_multiplier: 1,
                    numeric_ability_code: 'DEXTERITY',
                    numeric_min: null,
                    numeric_max: null,
                    numeric_skill_id: null,
                    numeric_class_id: null,
                    set_amount: null,
                    charge_limit_kind: null,
                    charge_scaling_kind: null,
                    charge_amount: null,
                    charge_multiplier: null,
                    charge_min: null,
                    charge_max: null,
                    dice: null,
                    damage_type_id: null,
                    condition_type_id: null,
                    movement_mode_id: null,
                    attribute_id: null,
                    range_kind: null,
                    duration_kind: null,
                    shape_kind: null,
                    reset_kind: null
                }],
            modifier_grant_charge_levels: [],
            modifier_grant_optional_abilities: []
        }) as never);
        await expect(repository.findById('feat-with-modifier')).resolves.toEqual({
            id: 'feat-with-modifier',
            label: 'Agile Striker',
            description: 'Quick on the draw.',
            status: 'DRAFT',
            details: undefined,
            prerequisites: undefined,
            effects: undefined,
            features: undefined,
            charges: undefined,
            grants: {
                feats: undefined,
                modifiers: [
                    {
                        id: 'modifier-1',
                        grantKind: 'MODIFIER_GRANT',
                        order: 1,
                        selectionKind: 'GRANTED',
                        count: undefined,
                        valueDomainCode: 'ATTACK_ROLL',
                        domain: {
                            attackDomain: 'MELEE'
                        },
                        modifierKind: 'ABILITY_MODIFIER_BONUS',
                        scope: 'SOURCE',
                        payload: {
                            ability: 'DEXTERITY',
                            min: undefined,
                            max: undefined,
                            multiplier: 1
                        },
                        restrictions: undefined
                    }
                ],
                proficiencies: undefined,
                senses: undefined,
                spells: undefined
            },
            userId: 'user-1',
            systemId: 'system-1'
        });
    });
    it('round-trips supported feat effects through the typed effect repository', async () => {
        const db = new InMemoryDb();
        const repository = createFeatRepository(db as never);
        await repository.upsert({
            id: 'feat-effects-1',
            label: 'Blazing Initiate',
            description: 'Carries a direct effect.',
            effects: [
                {
                    id: 'feat-effect-1',
                    order: 1,
                    invocation: {
                        kind: 'ACTION',
                        triggerCode: 'SPELL_ATTACK',
                        activation: {
                            code: 'ACTION',
                            amount: 1
                        },
                        range: {
                            id: 'feat-range-1',
                            rangeKind: 'DISTANCE',
                            amount: 30,
                            unit: 'FEET'
                        }
                    },
                    paths: [
                        {
                            id: 'feat-PATH_CODE-1',
                            order: 1,
                            pathCode: 'ON_HIT',
                            groupType: 'SINGLE',
                            selectionKind: 'FIXED',
                            resultBlock: {
                                id: 'feat-PATH_CODE-1',
                                resultKind: 'SINGLE',
                                outcomes: [
                                    {
                                        id: 'feat-PATH_CODE-1',
                                        effectKind: 'DAMAGE',
                                        damageTypeId: 'fire',
                                        valueKind: 'FIXED',
                                        scalingKind: 'NONE',
                                        amount: 6
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            userId: 'user-1',
            systemId: 'system-1'
        });
        await expect(repository.findById('feat-effects-1')).resolves.toMatchObject({
            id: 'feat-effects-1',
            label: 'Blazing Initiate',
            description: 'Carries a direct effect.',
            details: undefined,
            prerequisites: undefined,
            effects: [
                {
                    id: 'feat-effect-1',
                    order: 1,
                    invocation: {
                        kind: 'ACTION',
                        triggerCode: 'SPELL_ATTACK',
                        activation: {
                            code: 'ACTION',
                            amount: 1
                        },
                        range: {
                            id: 'feat-range-1',
                            rangeKind: 'DISTANCE',
                            amount: 30,
                            unit: 'FEET'
                        }
                    },
                    paths: [
                        {
                            id: 'feat-PATH_CODE-1',
                            pathCode: 'ON_HIT',
                            selectionKind: 'FIXED',
                            resultBlock: {
                                id: 'feat-PATH_CODE-1',
                                resultKind: 'SINGLE',
                                outcomes: [
                                    {
                                        id: 'feat-PATH_CODE-1',
                                        effectKind: 'DAMAGE',
                                        damageTypeId: 'fire',
                                        valueKind: 'FIXED',
                                        scalingKind: 'NONE',
                                        amount: 6
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            charges: undefined,
            grants: undefined,
            userId: 'user-1',
            systemId: 'system-1'
        });
    });
});




