import { describe, expect, it } from 'vitest'

import {
  createBackgroundRepository,
  createClassRepository,
  createEquipmentRepository,
  createFeatRepository,
  createFeatureRepository,
  createRaceRepository
} from '../repositories/index.js'

type RowMap = Record<string, unknown[]>

interface QueryTrace {
  table: string
  whereValues: unknown[]
}

function createTracingDb(rowsByTable: RowMap) {
  const queries: QueryTrace[] = []

  return {
    queries,
    db: {
      selectFrom(table: string) {
        const trace: QueryTrace = { table, whereValues: [] }
        queries.push(trace)
        const state = { filtered: [...(rowsByTable[table] ?? [])] }
        const builder = {
          select() {
            return builder
          },
          selectAll() {
            return builder
          },
          where(column: string, op: string, value: unknown) {
            trace.whereValues.push(value)
            state.filtered = state.filtered.filter((row) => {
              const rowValue = (row as Record<string, unknown>)[column]
              return op === 'in' && Array.isArray(value)
                ? value.includes(rowValue)
                : rowValue === value
            })
            return builder
          },
          orderBy() {
            return builder
          },
          async execute() {
            return state.filtered
          },
          async executeTakeFirst() {
            return state.filtered[0]
          }
        }

        return builder
      }
    }
  }
}

function featureRows(): RowMap {
  return {
    features: [
      {
        id: 'feature-active',
        label: 'Active feature',
        description: 'Contributes structural grants.',
        section_code: 'TRAIT',
        charge_id: null,
        restriction_id: null,
        sort_order: 1,
        available_at_level: 1
      }
    ],
    feature_effects: [{ feature_id: 'feature-active', effect_id: 'effect-feature', sort_order: 1 }],
    feature_details: [],
    feature_attributes: [],
    feature_feat_grants: [],
    feature_modifier_grants: [
      { feature_id: 'feature-active', modifier_grant_id: 'modifier-active', sort_order: 1 }
    ],
    feature_proficiency_grants: [],
    feature_sense_grants: [],
    feature_spell_grants: [],
    feature_options: [{ feature_id: 'feature-active', option_id: 'option-active', sort_order: 1 }],
    feature_option_levels: [],
    options: [
      {
        id: 'option-active',
        label: 'Active option',
        description: 'Retains its structural option.',
        charge_id: null,
        restriction_id: null,
        sort_order: 1
      }
    ],
    option_effects: [{ option_id: 'option-active', effect_id: 'effect-option', sort_order: 1 }],
    option_details: [],
    option_attributes: [],
    option_feat_grants: [],
    option_modifier_grants: [],
    option_proficiency_grants: [],
    option_sense_grants: [],
    option_spell_grants: [],
    modifier_grants: [
      {
        id: 'modifier-active',
        sort_order: 1,
        selection_kind: 'GRANTED',
        count: null,
        selection_duplicate_policy: null,
        value_domain_code: 'ATTACK_ROLL',
        modifier_kind: 'ABILITY_MODIFIER_BONUS',
        scope: 'SOURCE',
        restriction_id: null
      }
    ],
    modifier_grant_domain_params: [
      {
        modifier_grant_id: 'modifier-active',
        value_domain_code: 'ATTACK_ROLL',
        attack_domain_code: 'MELEE',
        ability_code: null,
        skill_id: null,
        speed_id: null,
        sense_code: null,
        spell_level: null,
        condition_type_id: null
      }
    ],
    modifier_grant_payloads: [
      {
        modifier_grant_id: 'modifier-active',
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
      }
    ],
    modifier_grant_charge_levels: [],
    modifier_grant_optional_abilities: []
  }
}

function expectOnlyActiveFeatureWasHydrated(queries: readonly QueryTrace[]) {
  const featureQueries = queries.filter((query) => query.table === 'features')
  expect(featureQueries).toHaveLength(1)
  expect(featureQueries[0]?.whereValues).toEqual([['feature-active']])
}

describe('character assembly repository projections', () => {
  it('keeps feature structure and modifiers while skipping feature and option mechanics', async () => {
    const trace = createTracingDb(featureRows())
    const repository = createFeatureRepository(trace.db as never)

    const features = await repository.findByIds(['feature-active'], { includeEffects: false })
    const feature = features.get('feature-active')

    expect(feature?.effects).toBeUndefined()
    expect(feature?.options?.[0]?.effects).toBeUndefined()
    expect(feature?.options?.[0]?.id).toBe('option-active')
    expect(feature?.grants?.modifiers?.[0]?.id).toBe('modifier-active')
    expect(trace.queries.map((query) => query.table)).not.toContain('feature_effects')
    expect(trace.queries.map((query) => query.table)).not.toContain('option_effects')
    expect(trace.queries.map((query) => query.table)).not.toContain('effects')
  })

  it('keeps full feature hydration as the default', async () => {
    const trace = createTracingDb(featureRows())
    const repository = createFeatureRepository(trace.db as never)

    await expect(repository.findByIds(['feature-active'])).rejects.toThrow(
      'linked to missing effect'
    )
    expect(trace.queries.map((query) => query.table)).toContain('feature_effects')
    expect(trace.queries.map((query) => query.table)).toContain('option_effects')
    expect(trace.queries.map((query) => query.table)).toContain('effects')
  })

  it('filters Race root and ancestry-option features before hydration', async () => {
    const trace = createTracingDb({
      ...featureRows(),
      races: [
        {
          id: 'race-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Race',
          quote: null,
          description: null,
          status: 'DRAFT',
          category: 'BASE',
          selection_mode: 'DIRECT',
          parent_race_id: null,
          size_code: 'MEDIUM'
        }
      ],
      race_features: [
        { race_id: 'race-1', feature_id: 'feature-active', sort_order: 1 },
        { race_id: 'race-1', feature_id: 'feature-future', sort_order: 2 }
      ],
      race_ancestries: [
        { id: 'ancestry-1', race_id: 'race-1', label: 'Ancestry', description: null }
      ],
      race_ancestry_options: [
        {
          id: 'ancestry-option-1',
          ancestry_id: 'ancestry-1',
          label: 'Future option',
          description: 'Not yet acquired.',
          sort_order: 1
        }
      ],
      race_ancestry_option_features: [
        {
          ancestry_option_id: 'ancestry-option-1',
          feature_id: 'feature-future',
          sort_order: 1
        }
      ]
    })

    const race = await createRaceRepository(trace.db as never).findById('race-1', {
      allowedFeatureIds: new Set(['feature-active']),
      includeFeatureEffects: false
    })

    expect(race?.features?.map((feature) => feature.id)).toEqual(['feature-active'])
    expect(
      race?.category === 'BASE' ? race.ancestry?.options[0]?.features : undefined
    ).toBeUndefined()
    expectOnlyActiveFeatureWasHydrated(trace.queries)
  })

  it('filters Class and Background features before hydration', async () => {
    const classTrace = createTracingDb({
      ...featureRows(),
      classes: [
        {
          id: 'class-1',
          system_id: 'system-1',
          user_id: 'user-1',
          category: 'SUBCLASS',
          parent_class_id: 'class-parent',
          subclass_selection_level: null,
          label: 'Subclass',
          description: null,
          status: 'DRAFT',
          starting_equipment_id: null
        }
      ],
      class_features: [
        { class_id: 'class-1', feature_id: 'feature-active', sort_order: 1 },
        { class_id: 'class-1', feature_id: 'feature-future', sort_order: 2 }
      ]
    })
    const backgroundTrace = createTracingDb({
      ...featureRows(),
      backgrounds: [
        {
          id: 'background-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Background',
          description: null,
          status: 'DRAFT',
          starting_equipment_id: null
        }
      ],
      background_features: [
        { background_id: 'background-1', feature_id: 'feature-active', sort_order: 1 },
        { background_id: 'background-1', feature_id: 'feature-future', sort_order: 2 }
      ]
    })
    const options = {
      allowedFeatureIds: new Set(['feature-active']),
      includeFeatureEffects: false
    }

    const [classRecord, background] = await Promise.all([
      createClassRepository(classTrace.db as never).findById('class-1', options),
      createBackgroundRepository(backgroundTrace.db as never).findById('background-1', options)
    ])

    expect(classRecord?.features?.map((feature) => feature.id)).toEqual(['feature-active'])
    expect(background?.features?.map((feature) => feature.id)).toEqual(['feature-active'])
    expectOnlyActiveFeatureWasHydrated(classTrace.queries)
    expectOnlyActiveFeatureWasHydrated(backgroundTrace.queries)
  })

  it('filters Feat features and skips its direct and nested mechanics', async () => {
    const trace = createTracingDb({
      ...featureRows(),
      feats: [
        {
          id: 'feat-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Feat',
          description: 'Assembly projection.',
          status: 'DRAFT',
          prerequisite_id: null,
          charge_id: null
        }
      ],
      feat_effects: [{ feat_id: 'feat-1', effect_id: 'effect-feat', sort_order: 1 }],
      feat_features: [
        { feat_id: 'feat-1', feature_id: 'feature-active', sort_order: 1 },
        { feat_id: 'feat-1', feature_id: 'feature-future', sort_order: 2 }
      ]
    })

    const feat = await createFeatRepository(trace.db as never).findById('feat-1', {
      allowedFeatureIds: new Set(['feature-active']),
      includeEffects: false
    })

    expect(feat?.effects).toBeUndefined()
    expect(feat?.features?.map((feature) => feature.id)).toEqual(['feature-active'])
    expect(feat?.features?.[0]?.grants?.modifiers?.[0]?.id).toBe('modifier-active')
    expect(trace.queries.map((query) => query.table)).not.toContain('feat_effects')
    expect(trace.queries.map((query) => query.table)).not.toContain('feature_effects')
    expectOnlyActiveFeatureWasHydrated(trace.queries)
  })

  it('filters Equipment features and skips its direct and nested mechanics', async () => {
    const trace = createTracingDb({
      ...featureRows(),
      equipment: [
        {
          id: 'equipment-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Equipment',
          description: null,
          quote: null,
          status: 'DRAFT',
          category: 'ADVENTURING_GEAR',
          rarity_id: null,
          cost_amount: null,
          cost_currency_id: null,
          weight_amount: 1,
          weight_unit: 'POUNDS',
          capacity_amount: null,
          capacity_unit: null,
          max_stack: null,
          max_bonus: null,
          armor_class: null,
          requires_attunement: false,
          charge_id: null,
          restriction_id: null,
          parent_equipment_id: null
        }
      ],
      equipment_effects: [
        {
          equipment_id: 'equipment-1',
          effect_id: 'effect-equipment',
          sort_order: 1
        }
      ],
      equipment_features: [
        { equipment_id: 'equipment-1', feature_id: 'feature-active', sort_order: 1 },
        { equipment_id: 'equipment-1', feature_id: 'feature-future', sort_order: 2 }
      ]
    })

    const equipment = await createEquipmentRepository(trace.db as never).findById('equipment-1', {
      allowedFeatureIds: new Set(['feature-active']),
      includeEffects: false
    })

    expect(equipment?.effects).toBeUndefined()
    expect(equipment?.features?.map((feature) => feature.id)).toEqual(['feature-active'])
    expect(equipment?.features?.[0]?.grants?.modifiers?.[0]?.id).toBe('modifier-active')
    expect(trace.queries.map((query) => query.table)).not.toContain('equipment_effects')
    expect(trace.queries.map((query) => query.table)).not.toContain('feature_effects')
    expectOnlyActiveFeatureWasHydrated(trace.queries)
  })
})
