import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '../types/index.js'

const wrapperCalls: string[] = []
const wrapperDatabases: unknown[] = []

vi.mock('../domains/index.js', () => {
  const track = (name: string) => vi.fn(async (db: unknown) => {
    wrapperCalls.push(name)
    wrapperDatabases.push(db)
  })

  return {
    upsertBackground: track('upsertBackground'),
    upsertCharge: track('upsertCharge'),
    upsertClass: track('upsertClass'),
    upsertClassRoot: track('upsertClassRoot'),
    upsertCreature: track('upsertCreature'),
    upsertDetail: track('upsertDetail'),
    upsertEffect: track('upsertEffect'),
    upsertEquipment: track('upsertEquipment'),
    upsertFeat: track('upsertFeat'),
    upsertFeatGrant: track('upsertFeatGrant'),
    upsertFeature: track('upsertFeature'),
    upsertModifierGrant: track('upsertModifierGrant'),
    upsertOption: track('upsertOption'),
    upsertProficiencyGrant: track('upsertProficiencyGrant'),
    upsertRace: track('upsertRace'),
    upsertSavingThrow: track('upsertSavingThrow'),
    upsertSenseGrant: track('upsertSenseGrant'),
    upsertSpell: track('upsertSpell'),
    upsertSpellGrant: track('upsertSpellGrant'),
    upsertStartingEquipment: track('upsertStartingEquipment'),
    upsertSystem: track('upsertSystem'),
    upsertVehicle: track('upsertVehicle')
  }
})

vi.mock('../repositories/index.js', () => ({
  createAuthoredDefinitionRepository: vi.fn(() => ({
    syncMaster: vi.fn()
  })),
  createAuthoredRouteIdRepository: vi.fn(() => ({
    seedSrdSubjects: vi.fn()
  }))
}))

import { seedBaselineContent } from '../seed/baseline.js'
import { defineBaselineContentBundle } from '../source-data/content.js'

type SeedRow = Record<string, unknown>
type SeedTables = Record<string, SeedRow[]>
type WhereOperator = '=' | 'in' | 'not in'

function createSeedTransactionDb(initialTables: SeedTables = {}) {
  const tables = structuredClone(initialTables)
  const operations: Array<{ operation: string, table: string }> = []

  const createQuery = (operation: 'select' | 'delete' | 'update', table: string) => {
    const predicates: Array<(row: SeedRow) => boolean> = []
    let update: SeedRow = {}
    const query = {
      select() {
        return query
      },
      set(values: SeedRow) {
        update = values
        return query
      },
      where(column: string, operator: WhereOperator, value: unknown) {
        predicates.push((row) => {
          if (operator === '=') return row[column] === value
          const values = value as readonly unknown[]
          return operator === 'in'
            ? values.includes(row[column])
            : !values.includes(row[column])
        })
        return query
      },
      async execute() {
        operations.push({ operation, table })
        const rows = tables[table] ?? []
        const matches = (row: SeedRow) => predicates.every((predicate) => predicate(row))

        if (operation === 'select') return rows.filter(matches).map((row) => ({ ...row }))
        if (operation === 'delete') {
          tables[table] = rows.filter((row) => !matches(row))
          return []
        }

        for (const row of rows.filter(matches)) Object.assign(row, update)
        return []
      }
    }
    return query
  }

  const db = {
    isTransaction: true,
    selectFrom: (table: string) => createQuery('select', table),
    deleteFrom: (table: string) => createQuery('delete', table),
    updateTable: (table: string) => createQuery('update', table)
  }

  return { db, operations, tables }
}

function createEmptyBundle(systemId = 'system-1') {
  return defineBaselineContentBundle({
    vocabulary: {
      systems: [{
        id: systemId,
        label: 'System',
        description: null,
        rulesetCode: 'dnd5e',
        rulesetVersion: '2014',
        alignments: [],
        challengeRatings: [],
        conditionTypes: [],
        creatureTypes: [],
        currencies: [],
        damageTypes: [],
        heritages: [],
        languages: [],
        lifestyles: [],
        magicSchools: [],
        passives: [],
        rarities: [],
        senses: [],
        skills: [],
        speeds: [],
        terrains: [],
        userId: 'user-1'
      }]
    },
    shared: {
      charges: [],
      details: [],
      savingThrows: [],
      startingEquipment: []
    },
    effects: { effects: [] },
    features: { features: [], options: [] },
    grants: {
      feats: [],
      modifiers: [],
      proficiencies: [],
      senses: [],
      spells: []
    },
    subjects: {
      backgrounds: [],
      classes: [],
      creatures: [],
      equipment: [],
      feats: [],
      races: [],
      spells: [],
      vehicles: []
    }
  })
}

describe('seedBaselineContent', () => {
  beforeEach(() => {
    wrapperCalls.length = 0
    wrapperDatabases.length = 0
  })

  it('seeds systems before system-scoped content and returns counts', async () => {
    const bundle = defineBaselineContentBundle({
      vocabulary: {
        systems: [
          {
            id: 'system-1',
            label: 'System',
            description: null,
            rulesetCode: 'dnd5e',
            rulesetVersion: '2014',
            alignments: [],
            challengeRatings: [],
            conditionTypes: [],
            creatureTypes: [],
            currencies: [],
            damageTypes: [],
            heritages: [],
            languages: [],
            lifestyles: [],
            magicSchools: [],
            passives: [],
            rarities: [],
            senses: [],
            skills: [],
            speeds: [],
            terrains: [],
            userId: 'user-1'
          }
        ]
      },
      shared: {
        charges: [{ id: 'charge-1', scalingKind: 'NONE', resetKind: 'LONG_REST', limitKind: 'FIXED_AMOUNT', amount: 1 }],
        details: [{ id: 'detail-1', label: 'Detail', description: 'Description', order: 1 }],
        savingThrows: [{ id: 'save-1', ability: 'DEXTERITY', dcMethod: 'FIXED_DC', baseDc: 14 }],
        startingEquipment: [{ id: 'se-1', sets: [] }]
      },
      effects: {
        effects: []
      },
      features: {
        features: [],
        options: []
      },
      grants: {
        feats: [],
        modifiers: [],
        proficiencies: [],
        senses: [],
        spells: []
      },
      subjects: {
        backgrounds: [],
        classes: [],
        creatures: [],
        equipment: [],
        feats: [],
        races: [],
        spells: [],
        vehicles: []
      }
    })

    const { db } = createSeedTransactionDb()
    const result = await seedBaselineContent({ db: db as unknown as DBLike, systemId: 'system-1' }, bundle)

    expect(wrapperCalls).toEqual([
      'upsertSystem',
      'upsertDetail',
      'upsertCharge',
      'upsertSavingThrow',
      'upsertStartingEquipment'
    ])
    expect(result).toEqual({
      systems: 1,
      domainRoots: 0
    })
  })

  it('throws when the requested system is missing from the bundle', async () => {
    const bundle = defineBaselineContentBundle({
      vocabulary: {
        systems: []
      },
      shared: {
        charges: [],
        details: [],
        savingThrows: [],
        startingEquipment: []
      },
      effects: {
        effects: []
      },
      features: {
        features: [],
        options: []
      },
      grants: {
        feats: [],
        modifiers: [],
        proficiencies: [],
        senses: [],
        spells: []
      },
      subjects: {
        backgrounds: [],
        classes: [],
        creatures: [],
        equipment: [],
        feats: [],
        races: [],
        spells: [],
        vehicles: []
      }
    })

    const { db } = createSeedTransactionDb()
    await expect(seedBaselineContent({ db: db as unknown as DBLike, systemId: 'missing-system' }, bundle))
      .rejects.toThrow('Missing system seed record')
  })

  it('removes stale master subjects across every root domain while preserving owned, current, and other-system records', async () => {
    const bundle = createEmptyBundle()
    bundle.subjects.backgrounds.push({
      id: 'current-background',
      label: 'Current background',
      systemId: 'system-1'
    } as unknown as typeof bundle.subjects.backgrounds[number])

    const staleSubjects = [
      ['backgrounds', 'BACKGROUND'],
      ['classes', 'CLASS'],
      ['creatures', 'CREATURE'],
      ['equipment', 'EQUIPMENT'],
      ['feats', 'FEAT'],
      ['races', 'RACE'],
      ['spells', 'SPELL'],
      ['vehicles', 'VEHICLE']
    ] as const
    const initialTables: SeedTables = {
      backgrounds: [
        { id: 'stale-backgrounds', system_id: 'system-1', is_master: true },
        { id: 'current-background', system_id: 'system-1', is_master: true },
        { id: 'owned-background', system_id: 'system-1', is_master: false },
        { id: 'other-system-background', system_id: 'system-2', is_master: true }
      ],
      authored_definitions: [
        {
          subject_id: 'current-background',
          subject_kind: 'BACKGROUND',
          system_id: 'system-1',
          is_master: true
        },
        {
          subject_id: 'owned-background',
          subject_kind: 'BACKGROUND',
          system_id: 'system-1',
          is_master: false
        }
      ],
      authored_route_ids: [
        { subject_id: 'current-background', subject_kind: 'BACKGROUND' },
        { subject_id: 'owned-background', subject_kind: 'BACKGROUND' }
      ]
    }

    for (const [table, subjectKind] of staleSubjects) {
      if (table !== 'backgrounds') {
        initialTables[table] = [{ id: `stale-${table}`, system_id: 'system-1', is_master: true }]
      }
      initialTables.authored_definitions?.push({
        subject_id: `stale-${table}`,
        subject_kind: subjectKind,
        system_id: 'system-1',
        is_master: true
      })
      initialTables.authored_route_ids?.push({
        subject_id: `stale-${table}`,
        subject_kind: subjectKind
      })
    }

    const { db, tables } = createSeedTransactionDb(initialTables)
    await seedBaselineContent({ db: db as unknown as DBLike, systemId: 'system-1' }, bundle)

    for (const [table] of staleSubjects) {
      expect(tables[table]).not.toContainEqual(expect.objectContaining({ id: `stale-${table}` }))
    }
    expect(tables.backgrounds).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'current-background' }),
      expect.objectContaining({ id: 'owned-background', is_master: false }),
      expect.objectContaining({ id: 'other-system-background', system_id: 'system-2' })
    ]))
    expect(tables.authored_definitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ subject_id: 'current-background', is_master: true }),
      expect.objectContaining({ subject_id: 'owned-background', is_master: false })
    ]))
    expect(tables.authored_definitions).toHaveLength(2)
    expect(tables.authored_route_ids).toEqual(expect.arrayContaining([
      expect.objectContaining({ subject_id: 'current-background' }),
      expect.objectContaining({ subject_id: 'owned-background' })
    ]))
    expect(tables.authored_route_ids).toHaveLength(2)
  })

  it('clears stale cross-domain references before deleting master projections', async () => {
    const bundle = createEmptyBundle()
    const { db, operations, tables } = createSeedTransactionDb({
      classes: [{ id: 'stale-class', system_id: 'system-1', is_master: true }],
      equipment: [{ id: 'stale-equipment', system_id: 'system-1', is_master: true }],
      feats: [{ id: 'stale-feat', system_id: 'system-1', is_master: true }],
      spells: [{ id: 'stale-spell', system_id: 'system-1', is_master: true }],
      equipment_contains: [{ equipment_id: 'kept-container', contained_equipment_id: 'stale-equipment' }],
      starting_equipment_option_item_equipment: [{ equipment_id: 'stale-equipment' }],
      proficiency_grant_equipment: [{ equipment_id: 'stale-equipment' }],
      spell_classes: [{ spell_id: 'kept-spell', class_id: 'stale-class' }],
      feat_grant_feats: [{ feat_id: 'stale-feat' }],
      feat_grant_scaling_level_feats: [{ feat_id: 'stale-feat' }],
      spell_grant_spells: [{ spell_id: 'stale-spell' }],
      spell_grant_scaling_level_spells: [{ spell_id: 'stale-spell' }]
    })

    await seedBaselineContent({ db: db as unknown as DBLike, systemId: 'system-1' }, bundle)

    for (const table of [
      'equipment_contains',
      'starting_equipment_option_item_equipment',
      'proficiency_grant_equipment',
      'spell_classes',
      'feat_grant_feats',
      'feat_grant_scaling_level_feats',
      'spell_grant_spells',
      'spell_grant_scaling_level_spells'
    ]) {
      expect(tables[table]).toEqual([])
    }
    expect(operations.findIndex(({ table }) => table === 'equipment_contains'))
      .toBeLessThan(operations.findIndex(({ operation, table }) => operation === 'delete' && table === 'equipment'))
    expect(operations.findIndex(({ table }) => table === 'spell_classes'))
      .toBeLessThan(operations.findIndex(({ operation, table }) => operation === 'delete' && table === 'classes'))
  })

  it('runs pruning and all writes through one outer transaction', async () => {
    const bundle = createEmptyBundle()
    const transaction = createSeedTransactionDb()
    const execute = vi.fn(async (callback: (db: unknown) => Promise<unknown>) => callback(transaction.db))
    const db = {
      isTransaction: false,
      transaction: () => ({ execute })
    }

    await seedBaselineContent({ db: db as unknown as DBLike, systemId: 'system-1' }, bundle)

    expect(execute).toHaveBeenCalledOnce()
    expect(wrapperDatabases).not.toHaveLength(0)
    expect(wrapperDatabases.every((wrapperDb) => wrapperDb === transaction.db)).toBe(true)
    expect(transaction.operations[0]).toEqual({ operation: 'select', table: 'backgrounds' })
  })
})

