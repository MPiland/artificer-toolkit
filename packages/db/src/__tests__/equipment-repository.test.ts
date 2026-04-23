import { describe, expect, it } from 'vitest';
import { createEquipmentRepository } from '../repositories/index.js';
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
                selectAll() {
                    return builder;
                },
                where(column: string, _op: string, value: string) {
                    state.filtered = state.filtered.filter((row) => {
                        const record = row as Record<string, unknown>;
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
describe('createEquipmentRepository', () => {
    it('hydrates supported base equipment rows', async () => {
        const repository = createEquipmentRepository(createFakeDb({
            equipment: [
                {
                    id: 'equipment-1',
                    system_id: 'system-1',
                    user_id: 'user-1',
                    label: 'Longsword',
                    description: 'A martial blade.',
                    quote: 'Sharp steel.',
                    category: 'WEAPON',
                    rarity_id: 'common',
                    cost_amount: 15,
                    cost_currency_id: 'gp',
                    weight_amount: 3,
                    weight_unit: 'POUNDS',
                    capacity_amount: null,
                    capacity_unit: null,
                    max_stack: null,
                    max_bonus: 1,
                    armor_class: null,
                    charge_id: 'charge-1',
                    restriction_id: null,
                    parent_equipment_id: null
                }
            ],
            equipment_effects: [],
            equipment_modifier_grants: [
                { equipment_id: 'equipment-1', modifier_grant_id: 'modifier-1', sort_order: 1 }
            ],
            equipment_features: [
                { equipment_id: 'equipment-1', feature_id: 'feature-1', sort_order: 1 }
            ],
            features: [
                {
                    id: 'feature-1',
                    label: 'Parrying',
                    description: 'Gain a defensive flourish.',
                    detail: null,
                    charge_id: null,
                    restriction_id: null,
                    sort_order: 1,
                    available_at_level: null
                }
            ],
            feature_effects: [],
            feature_attributes: [],
            feature_feat_grants: [],
            feature_modifier_grants: [],
            feature_proficiency_grants: [],
            feature_sense_grants: [],
            feature_spell_grants: [],
            feature_options: [],
            feature_option_levels: [],
            equipment_attributes: [
                { equipment_id: 'equipment-1', attribute_code: 'LIMITED_USE', sort_order: 1 }
            ],
            equipment_properties: [
                { equipment_id: 'equipment-1', property_code: 'MARTIAL' },
                { equipment_id: 'equipment-1', property_code: 'VERSATILE' }
            ],
            equipment_contains: [
                { equipment_id: 'equipment-1', contained_equipment_id: 'sheath-1', quantity: 1 }
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
            modifier_grants: [{
                    id: 'modifier-1',
                    sort_order: 1,
                    selection_kind: 'GRANTED',
                    count: null,
                    value_domain_code: 'ARMOR_CLASS',
                    modifier_kind: 'SET_VALUE',
                    scope: 'SOURCE',
                    restriction_id: null
                }],
            modifier_grant_domain_params: [],
            modifier_grant_payloads: [{
                    modifier_grant_id: 'modifier-1',
                    modifier_kind: 'SET_VALUE',
                    value_domain_code: 'ARMOR_CLASS',
                    numeric_value_kind: null,
                    numeric_amount: null,
                    numeric_multiplier: null,
                    numeric_ability_code: null,
                    numeric_skill_id: null,
                    numeric_class_id: null,
                    set_amount: 17,
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
        await expect(repository.findById('equipment-1')).resolves.toEqual({
            kind: 'EQUIPMENT',
            id: 'equipment-1',
            label: 'Longsword',
            description: 'A martial blade.',
            attributes: ['LIMITED_USE'],
            quote: 'Sharp steel.',
            cost: { amount: 15, currencyId: 'gp' },
            weight: { amount: 3, unit: 'POUNDS' },
            effects: undefined,
            charges: {
                id: 'charge-1',
                resetKind: 'LONG_REST',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 1
            },
            capacity: undefined,
            modifiers: [
                {
                    id: 'modifier-1',
                    grantKind: 'MODIFIER_GRANT',
                    order: 1,
                    selectionKind: 'GRANTED',
                    count: undefined,
                    valueDomainCode: 'ARMOR_CLASS',
                    domain: {},
                    modifierKind: 'SET_VALUE',
                    scope: 'SOURCE',
                    payload: { amount: 17 }
                }
            ],
            maxStack: undefined,
            rarityId: 'common',
            maxBonus: 1,
            armorClass: undefined,
            contains: [
                { equipmentId: 'sheath-1', quantity: 1 }
            ],
            features: [
                {
                    id: 'feature-1',
                    label: 'Parrying',
                    description: 'Gain a defensive flourish.',
                    attributes: undefined,
                    detail: undefined,
                    effects: undefined,
                    charges: undefined,
                    grants: undefined,
                    restrictions: undefined,
                    order: 1,
                    availableAtLevel: undefined,
                    optionChoices: undefined,
                    options: undefined
                }
            ],
            restrictions: undefined,
            userId: 'user-1',
            systemId: 'system-1',
            properties: ['MARTIAL', 'VERSATILE'],
            category: 'WEAPON'
        });
    });
    it('fails loudly when a linked restriction facet row is missing', async () => {
        const repository = createEquipmentRepository(createFakeDb({
            equipment: [
                {
                    id: 'equipment-bad',
                    system_id: 'system-1',
                    user_id: 'user-1',
                    label: 'Broken Item',
                    description: null,
                    quote: null,
                    category: 'WEAPON',
                    rarity_id: 'common',
                    cost_amount: 1,
                    cost_currency_id: 'gp',
                    weight_amount: 1,
                    weight_unit: 'POUNDS',
                    capacity_amount: null,
                    capacity_unit: null,
                    max_stack: null,
                    max_bonus: null,
                    armor_class: null,
                    charge_id: null,
                    restriction_id: 'facet-1',
                    parent_equipment_id: null
                }
            ]
        }) as never);
        await expect(repository.findById('equipment-bad')).rejects.toThrow('missing restriction facet');
    });
    it('hydrates supported equipment variants', async () => {
        const repository = createEquipmentRepository(createFakeDb({
            equipment: [
                {
                    id: 'equipment-variant-1',
                    system_id: 'system-1',
                    user_id: 'user-1',
                    label: 'Flame Tongue Longsword',
                    description: 'A variant weapon.',
                    quote: null,
                    category: 'VARIANT',
                    rarity_id: 'rare',
                    cost_amount: null,
                    cost_currency_id: null,
                    weight_amount: null,
                    weight_unit: null,
                    capacity_amount: null,
                    capacity_unit: null,
                    max_stack: null,
                    max_bonus: 2,
                    armor_class: null,
                    charge_id: null,
                    restriction_id: null,
                    parent_equipment_id: 'equipment-parent-1'
                }
            ],
            equipment_effects: [],
            equipment_modifier_grants: [],
            equipment_features: [],
            equipment_attributes: [],
            equipment_properties: [
                {
                    equipment_id: 'equipment-variant-1',
                    property_code: 'MAGIC'
                }
            ],
            equipment_contains: []
        }) as never);
        await expect(repository.findById('equipment-variant-1')).resolves.toEqual({
            kind: 'EQUIPMENT',
            id: 'equipment-variant-1',
            label: 'Flame Tongue Longsword',
            description: 'A variant weapon.',
            attributes: undefined,
            quote: undefined,
            cost: undefined,
            effects: undefined,
            charges: undefined,
            capacity: undefined,
            modifiers: undefined,
            maxStack: undefined,
            rarityId: 'rare',
            maxBonus: 2,
            armorClass: undefined,
            contains: undefined,
            features: undefined,
            restrictions: undefined,
            userId: 'user-1',
            systemId: 'system-1',
            category: 'VARIANT',
            parentEquipmentId: 'equipment-parent-1',
            properties: ['MAGIC']
        });
    });
    it('resolves variant equipment against parent data for effective reads', async () => {
        const db = new InMemoryDb();
        const repository = createEquipmentRepository(db as never);
        await repository.upsert({
            kind: 'EQUIPMENT',
            id: 'equipment-parent-1',
            label: 'Longsword',
            description: 'A martial blade.',
            weight: { amount: 3, unit: 'POUNDS' },
            rarityId: 'common',
            userId: 'user-1',
            systemId: 'system-1',
            properties: ['MARTIAL', 'VERSATILE'],
            category: 'WEAPON',
            effects: [
                {
                    id: 'parent-effect-1',
                    order: 1,
                    invocation: {
                        kind: 'ACTION',
                        triggerCode: 'MELEE_WEAPON_ATTACK',
                        activation: { code: 'FREE' },
                        range: { id: 'parent-range-1', rangeKind: 'SELF' }
                    },
                    paths: [
                        {
                            id: 'parent-path-1',
                            order: 1,
                            pathCode: 'ON_HIT',
                            groupType: 'SINGLE',
                            selectionKind: 'FIXED',
                            resultBlock: {
                                id: 'parent-path-1__result',
                                resultKind: 'SINGLE',
                                outcomes: [
                                    {
                                        id: 'parent-outcome-1',
                                        effectKind: 'DAMAGE',
                                        damageTypeId: 'slashing',
                                        valueKind: 'FIXED',
                                        scalingKind: 'NONE',
                                        amount: 8
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        });
        await repository.upsert({
            kind: 'EQUIPMENT',
            id: 'equipment-variant-1',
            label: 'Longsword +1',
            description: null,
            rarityId: 'uncommon',
            userId: 'user-1',
            systemId: 'system-1',
            category: 'VARIANT',
            parentEquipmentId: 'equipment-parent-1',
            properties: ['MAGIC'],
            maxBonus: 1,
            modifiers: [
                {
                    id: 'variant-modifier-1',
                    grantKind: 'MODIFIER_GRANT',
                    order: 1,
                    selectionKind: 'GRANTED',
                    valueDomainCode: 'ATTACK_ROLL',
                    domain: { attackDomain: 'MELEE' },
                    modifierKind: 'BONUS',
                    scope: 'SOURCE',
                    payload: {
                        valueKind: 'FIXED',
                        amount: 1
                    }
                }
            ]
        });
        await expect(repository.findResolvedById('equipment-variant-1')).resolves.toMatchObject({
            id: 'equipment-variant-1',
            label: 'Longsword +1',
            description: 'A martial blade.',
            category: 'WEAPON',
            properties: ['MARTIAL', 'VERSATILE', 'MAGIC'],
            maxBonus: 1,
            effects: [
                {
                    id: 'parent-effect-1'
                }
            ],
            modifiers: [
                {
                    id: 'variant-modifier-1'
                }
            ],
            variant: {
                parentEquipmentId: 'equipment-parent-1',
                parentLabel: 'Longsword',
                inherited: {
                    category: 'WEAPON',
                    properties: ['MARTIAL', 'VERSATILE']
                }
            }
        });
        await expect(repository.findResolvedAll({ systemId: 'system-1' })).resolves.toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'equipment-variant-1',
                category: 'WEAPON',
                properties: ['MARTIAL', 'VERSATILE', 'MAGIC']
            })
        ]));
    });
    it('round-trips supported equipment effects through the typed effect repository', async () => {
        const db = new InMemoryDb();
        const repository = createEquipmentRepository(db as never);
        await repository.upsert({
            kind: 'EQUIPMENT',
            id: 'equipment-effects-1',
            label: 'Storm Blade',
            description: 'An energized weapon.',
            cost: { amount: 50, currencyId: 'gp' },
            weight: { amount: 4, unit: 'POUNDS' },
            rarityId: 'uncommon',
            effects: [
                {
                    id: 'equipment-effect-1',
                    order: 1,
                    invocation: {
                        kind: 'ACTION',
                        triggerCode: 'MELEE_WEAPON_ATTACK',
                        activation: {
                            code: 'FREE'
                        },
                        range: {
                            id: 'equipment-range-1',
                            rangeKind: 'SELF'
                        }
                    },
                    paths: [
                        {
                            id: 'equipment-PATH_CODE-1',
                            order: 1,
                            pathCode: 'ON_HIT',
                            groupType: 'SINGLE',
                            selectionKind: 'FIXED',
                            resultBlock: {
                                id: 'equipment-PATH_CODE-1__result',
                                resultKind: 'SINGLE',
                                outcomes: [
                                    {
                                        id: 'equipment-PATH_CODE-1',
                                        effectKind: 'DAMAGE',
                                        damageTypeId: 'lightning',
                                        valueKind: 'FIXED',
                                        scalingKind: 'NONE',
                                        amount: 4
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            userId: 'user-1',
            systemId: 'system-1',
            properties: ['MARTIAL'],
            category: 'WEAPON'
        });
        await expect(repository.findById('equipment-effects-1')).resolves.toMatchObject({
            kind: 'EQUIPMENT',
            id: 'equipment-effects-1',
            label: 'Storm Blade',
            description: 'An energized weapon.',
            attributes: undefined,
            quote: undefined,
            cost: { amount: 50, currencyId: 'gp' },
            weight: { amount: 4, unit: 'POUNDS' },
            effects: [
                {
                    id: 'equipment-effect-1',
                    order: 1,
                    invocation: {
                        kind: 'ACTION',
                        triggerCode: 'MELEE_WEAPON_ATTACK',
                        activation: {
                            code: 'FREE'
                        },
                        range: {
                            id: 'equipment-range-1',
                            rangeKind: 'SELF'
                        }
                    },
                    paths: [
                        {
                            id: 'equipment-PATH_CODE-1',
                            pathCode: 'ON_HIT',
                            selectionKind: 'FIXED',
                            resultBlock: {
                                id: 'equipment-PATH_CODE-1__result',
                                resultKind: 'SINGLE',
                                outcomes: [
                                    {
                                        id: 'equipment-PATH_CODE-1',
                                        effectKind: 'DAMAGE',
                                        damageTypeId: 'lightning',
                                        valueKind: 'FIXED',
                                        scalingKind: 'NONE',
                                        amount: 4
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            charges: undefined,
            capacity: undefined,
            modifiers: undefined,
            maxStack: undefined,
            rarityId: 'uncommon',
            maxBonus: undefined,
            armorClass: undefined,
            contains: undefined,
            features: undefined,
            restrictions: undefined,
            userId: 'user-1',
            systemId: 'system-1',
            properties: ['MARTIAL'],
            category: 'WEAPON'
        });
    });
});



