import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike, NodeRuntimeQueryWhere } from '@artificer-toolkit/db'
import type { RelationshipPlan, WhereExpr } from '@artificer-toolkit/shared/maps'
import { executeRelationshipPlan, streamToOptions } from './relationshipExecutor.js'
import {
  nodeRuntimeSourceManifest,
  type NodeRuntimeSourceTable
} from './nodeRuntimeSourceManifest.js'

const dbMock = {} as DBLike
const nodeRuntimeQueryMock = vi.hoisted(() => ({
  rowsByTable: new Map<string, Record<string, unknown>[]>(),
  selectNodeRuntimeRows: vi.fn(
    async (
      _db: DBLike,
      tableName: string,
      _columns: readonly string[],
      _where?: NodeRuntimeQueryWhere,
      _systemId?: string
    ) => nodeRuntimeQueryMock.rowsByTable.get(tableName) ?? []
  )
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    selectNodeRuntimeRows: nodeRuntimeQueryMock.selectNodeRuntimeRows
  }
})

describe('node runtime relationship executor', () => {
  beforeEach(() => {
    nodeRuntimeQueryMock.rowsByTable.clear()
    nodeRuntimeQueryMock.selectNodeRuntimeRows.mockClear()
  })

  it('resolves direct table relationships into option DTOs', async () => {
    nodeRuntimeQueryMock.rowsByTable.set('classes', [
      { id: 'wizard', label: 'Wizard' },
      { id: 'fighter', label: 'Fighter' }
    ])

    const plan = {
      kind: 'TABLE',
      table: 'classes',
      selectColumns: ['id', 'label']
    } satisfies RelationshipPlan

    const result = streamToOptions(
      await executeRelationshipPlan(dbMock, plan, {
        systemId: 'dnd5e2014',
        values: {}
      })
    )

    expect(result).toEqual([
      { value: 'wizard', label: 'Wizard', description: undefined },
      { value: 'fighter', label: 'Fighter', description: undefined }
    ])
    expect(nodeRuntimeQueryMock.selectNodeRuntimeRows).toHaveBeenCalledWith(
      dbMock,
      'classes',
      ['id', 'label'],
      undefined,
      'dnd5e2014'
    )
  })

  it('preserves implicit option fields without selecting whole rows', async () => {
    nodeRuntimeQueryMock.rowsByTable.set('currencies', [
      {
        id: 'gold-piece',
        code: 'GP',
        label: 'Gold Piece',
        short: 'gp',
        tooltip: 'The standard gold coin.',
        description: null
      }
    ])

    const plan = {
      kind: 'TABLE',
      table: 'currencies'
    } satisfies RelationshipPlan

    const result = streamToOptions(await executeRelationshipPlan(dbMock, plan, { values: {} }))

    expect(result).toEqual([
      {
        value: 'gold-piece',
        label: 'Gold Piece',
        description: 'The standard gold coin.'
      }
    ])
    expect(nodeRuntimeQueryMock.selectNodeRuntimeRows).toHaveBeenCalledWith(
      dbMock,
      'currencies',
      ['id', 'code', 'label', 'short', 'tooltip', 'description'],
      undefined,
      undefined
    )
  })

  it('trusts all table relationships used by shipped node maps', async () => {
    const shippedRuntimeSources = Object.entries(nodeRuntimeSourceManifest) as readonly [
      NodeRuntimeSourceTable,
      readonly [string, ...string[]]
    ][]

    const results = await Promise.all(
      shippedRuntimeSources.map(async ([tableName, selectColumns]) => {
        nodeRuntimeQueryMock.rowsByTable.set(tableName, [])
        const plan = {
          kind: 'TABLE',
          table: tableName,
          selectColumns
        } satisfies RelationshipPlan

        return executeRelationshipPlan(dbMock, plan, { values: {} })
      })
    )

    expect(results).toEqual(shippedRuntimeSources.map(() => []))
  })

  it('applies trusted where expressions with local IdRefs', async () => {
    nodeRuntimeQueryMock.rowsByTable.set('equipment', [
      { id: 'rapier', label: 'Rapier', category: 'WEAPON' },
      { id: 'shield', label: 'Shield', category: 'ARMOR' }
    ])

    const plan = {
      kind: 'TABLE',
      table: 'equipment',
      selectColumns: ['id', 'label'],
      where: {
        kind: 'PREDICATE',
        column: 'category',
        op: 'IN',
        values: { from: 'LOCAL', path: ['categories'] }
      }
    } satisfies RelationshipPlan

    const result = streamToOptions(
      await executeRelationshipPlan(dbMock, plan, {
        values: { categories: ['WEAPON'] }
      })
    )

    expect(result).toEqual([{ value: 'rapier', label: 'Rapier', description: undefined }])
    expect(nodeRuntimeQueryMock.selectNodeRuntimeRows).toHaveBeenCalledWith(
      dbMock,
      'equipment',
      ['id', 'label', 'category'],
      { kind: 'PREDICATE', column: 'category', op: 'IN', values: ['WEAPON'] },
      undefined
    )
  })

  it('pushes resolved boolean predicates into the database query', async () => {
    nodeRuntimeQueryMock.rowsByTable.set('equipment', [
      { id: 'rapier', label: 'Rapier', category: 'WEAPON' },
      { id: 'shield', label: 'Shield', category: 'ARMOR' }
    ])

    const plan = {
      kind: 'TABLE',
      table: 'equipment',
      selectColumns: ['id', 'label'],
      where: {
        kind: 'AND',
        expressions: [
          { kind: 'PREDICATE', column: 'category', op: '!=', value: 'ARMOR' },
          {
            kind: 'OR',
            expressions: [
              {
                kind: 'PREDICATE',
                column: 'id',
                op: '=',
                value: { from: 'LOCAL', path: ['selectedId'] }
              },
              {
                kind: 'NOT',
                expression: {
                  kind: 'PREDICATE',
                  column: 'id',
                  op: 'IN',
                  values: ['rapier', 'shield']
                }
              }
            ]
          }
        ]
      }
    } satisfies RelationshipPlan

    const result = streamToOptions(
      await executeRelationshipPlan(dbMock, plan, {
        values: { selectedId: 'rapier' }
      })
    )

    expect(result).toEqual([{ value: 'rapier', label: 'Rapier', description: undefined }])
    expect(nodeRuntimeQueryMock.selectNodeRuntimeRows).toHaveBeenCalledWith(
      dbMock,
      'equipment',
      ['id', 'label', 'category'],
      {
        kind: 'AND',
        expressions: [
          { kind: 'PREDICATE', column: 'category', op: '!=', value: 'ARMOR' },
          {
            kind: 'OR',
            expressions: [
              { kind: 'PREDICATE', column: 'id', op: '=', value: 'rapier' },
              {
                kind: 'NOT',
                expression: {
                  kind: 'PREDICATE',
                  column: 'id',
                  op: 'IN',
                  values: ['rapier', 'shield']
                }
              }
            ]
          }
        ]
      },
      undefined
    )
  })

  it('rejects legacy property-presence where expressions', async () => {
    // @ts-expect-error Legacy where expressions are intentionally unsupported.
    const legacyWhere: WhereExpr = { and: [] }
    const plan = {
      kind: 'TABLE',
      table: 'equipment',
      selectColumns: ['id'],
      where: legacyWhere
    } satisfies RelationshipPlan

    await expect(executeRelationshipPlan(dbMock, plan, { values: {} })).rejects.toThrow(
      'Unknown relationship where kind'
    )
  })

  it('resolves chain mapValues plans from local input values', async () => {
    nodeRuntimeQueryMock.rowsByTable.set('equipment_properties', [
      { property_code: 'FINESSE', equipment_id: 'rapier' },
      { property_code: 'HEAVY', equipment_id: 'maul' }
    ])
    nodeRuntimeQueryMock.rowsByTable.set('equipment', [
      { id: 'rapier', label: 'Rapier', category: 'WEAPON' },
      { id: 'maul', label: 'Maul', category: 'WEAPON' }
    ])

    const plan = {
      kind: 'CHAIN',
      mode: 'ROOT',
      steps: [
        {
          kind: 'MAP_VALUES',
          table: 'equipment_properties',
          whereColumn: 'property_code',
          valueColumn: 'equipment_id',
          input: { from: 'LOCAL', path: ['properties'] }
        },
        {
          kind: 'MAP_VALUES',
          table: 'equipment',
          whereColumn: 'id',
          valueColumn: 'id',
          selectColumns: ['id', 'label']
        }
      ]
    } satisfies RelationshipPlan

    const result = streamToOptions(
      await executeRelationshipPlan(dbMock, plan, {
        systemId: 'dnd5e2014',
        values: { properties: ['FINESSE'] }
      })
    )

    expect(result).toEqual([{ value: 'rapier', label: 'Rapier', description: undefined }])
    expect(nodeRuntimeQueryMock.selectNodeRuntimeRows).toHaveBeenNthCalledWith(
      1,
      dbMock,
      'equipment_properties',
      ['property_code', 'equipment_id'],
      { kind: 'PREDICATE', column: 'property_code', op: 'IN', values: ['FINESSE'] },
      'dnd5e2014'
    )
    expect(nodeRuntimeQueryMock.selectNodeRuntimeRows).toHaveBeenNthCalledWith(
      2,
      dbMock,
      'equipment',
      ['id', 'label'],
      { kind: 'PREDICATE', column: 'id', op: 'IN', values: ['rapier'] },
      'dnd5e2014'
    )
  })

  it('selects condition branches from runtime values', async () => {
    nodeRuntimeQueryMock.rowsByTable.set('equipment', [
      { id: 'rapier', label: 'Rapier', category: 'WEAPON' },
      { id: 'shield', label: 'Shield', category: 'ARMOR' }
    ])
    nodeRuntimeQueryMock.rowsByTable.set('classes', [{ id: 'wizard', label: 'Wizard' }])

    const plan = {
      kind: 'CONDITION',
      choices: [
        {
          useIf: {
            kind: 'PREDICATE',
            from: 'LOCAL',
            path: ['category'],
            op: '=',
            value: 'WEAPON'
          },
          plan: {
            kind: 'TABLE',
            table: 'equipment',
            selectColumns: ['id', 'label'],
            where: { kind: 'PREDICATE', column: 'category', op: '=', value: 'WEAPON' }
          }
        }
      ],
      fallback: {
        kind: 'TABLE',
        table: 'classes',
        selectColumns: ['id', 'label']
      }
    } satisfies RelationshipPlan

    const result = streamToOptions(
      await executeRelationshipPlan(dbMock, plan, {
        values: { category: 'WEAPON' }
      })
    )

    expect(result).toEqual([{ value: 'rapier', label: 'Rapier', description: undefined }])
  })

  it('merges union branch results inside chained relationships', async () => {
    nodeRuntimeQueryMock.rowsByTable.set('equipment', [
      { id: 'rapier', label: 'Rapier', category: 'WEAPON' },
      { id: 'shield', label: 'Shield', category: 'ARMOR' }
    ])

    const plan = {
      kind: 'CHAIN',
      mode: 'ROOT',
      steps: [
        {
          kind: 'SEED',
          table: 'equipment',
          valueColumn: 'id'
        },
        {
          kind: 'UNION',
          branches: [
            {
              kind: 'CHAIN',
              mode: 'CONTINUE',
              steps: [
                {
                  kind: 'MAP_VALUES',
                  table: 'equipment',
                  whereColumn: 'id',
                  valueColumn: 'id',
                  selectColumns: ['id', 'label'],
                  where: { kind: 'PREDICATE', column: 'category', op: '=', value: 'WEAPON' }
                }
              ]
            },
            {
              kind: 'CHAIN',
              mode: 'CONTINUE',
              steps: [
                {
                  kind: 'MAP_VALUES',
                  table: 'equipment',
                  whereColumn: 'id',
                  valueColumn: 'id',
                  selectColumns: ['id', 'label'],
                  where: { kind: 'PREDICATE', column: 'category', op: '=', value: 'ARMOR' }
                }
              ]
            }
          ]
        }
      ]
    } satisfies RelationshipPlan

    const result = streamToOptions(await executeRelationshipPlan(dbMock, plan, { values: {} }))

    expect(result).toEqual([
      { value: 'rapier', label: 'Rapier', description: undefined },
      { value: 'shield', label: 'Shield', description: undefined }
    ])
  })

  it('rejects untrusted table names safely', async () => {
    const plan = {
      kind: 'TABLE',
      table: 'not_allowed'
    } satisfies RelationshipPlan

    await expect(executeRelationshipPlan(dbMock, plan, { values: {} })).rejects.toThrow(
      'Untrusted node runtime table'
    )
  })

  it('rejects a trusted column when it is not allowed for the selected table', async () => {
    const plan = {
      kind: 'TABLE',
      table: 'classes',
      selectColumns: ['skill_id']
    } as unknown as RelationshipPlan

    await expect(executeRelationshipPlan(dbMock, plan, { values: {} })).rejects.toThrow(
      'Untrusted node runtime column for classes: skill_id'
    )
  })
})
