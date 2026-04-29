import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import type { RelationshipPlan } from '@artificer-toolkit/shared'
import { executeRelationshipPlan, streamToOptions } from './relationshipExecutor.js'

const dbMock = {} as DBLike
const nodeRuntimeQueryMock = vi.hoisted(() => ({
  rowsByTable: new Map<string, Record<string, unknown>[]>(),
  selectNodeRuntimeRows: vi.fn(async (_db: DBLike, tableName: string) =>
    nodeRuntimeQueryMock.rowsByTable.get(tableName) ?? []
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

    const result = streamToOptions(await executeRelationshipPlan(dbMock, plan, { values: {} }))

    expect(result).toEqual([
      { value: 'wizard', label: 'Wizard', description: undefined },
      { value: 'fighter', label: 'Fighter', description: undefined }
    ])
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
      where: { column: 'category', op: 'IN', values: { from: 'LOCAL', path: ['categories'] } }
    } satisfies RelationshipPlan

    const result = streamToOptions(await executeRelationshipPlan(dbMock, plan, {
      values: { categories: ['WEAPON'] }
    }))

    expect(result).toEqual([
      { value: 'rapier', label: 'Rapier', description: undefined }
    ])
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

    const result = streamToOptions(await executeRelationshipPlan(dbMock, plan, {
      values: { properties: ['FINESSE'] }
    }))

    expect(result).toEqual([
      { value: 'rapier', label: 'Rapier', description: undefined }
    ])
  })

  it('selects condition branches from runtime values', async () => {
    nodeRuntimeQueryMock.rowsByTable.set('equipment', [
      { id: 'rapier', label: 'Rapier', category: 'WEAPON' },
      { id: 'shield', label: 'Shield', category: 'ARMOR' }
    ])
    nodeRuntimeQueryMock.rowsByTable.set('classes', [
      { id: 'wizard', label: 'Wizard' }
    ])

    const plan = {
      kind: 'CONDITION',
      choices: [{
        useIf: { from: 'LOCAL', path: ['category'], op: '=', value: 'WEAPON' },
        plan: {
          kind: 'TABLE',
          table: 'equipment',
          selectColumns: ['id', 'label'],
          where: { column: 'category', op: '=', value: 'WEAPON' }
        }
      }],
      fallback: {
        kind: 'TABLE',
        table: 'classes',
        selectColumns: ['id', 'label']
      }
    } satisfies RelationshipPlan

    const result = streamToOptions(await executeRelationshipPlan(dbMock, plan, {
      values: { category: 'WEAPON' }
    }))

    expect(result).toEqual([
      { value: 'rapier', label: 'Rapier', description: undefined }
    ])
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
              steps: [{
                kind: 'MAP_VALUES',
                table: 'equipment',
                whereColumn: 'id',
                valueColumn: 'id',
                selectColumns: ['id', 'label'],
                where: { column: 'category', op: '=', value: 'WEAPON' }
              }]
            },
            {
              kind: 'CHAIN',
              mode: 'CONTINUE',
              steps: [{
                kind: 'MAP_VALUES',
                table: 'equipment',
                whereColumn: 'id',
                valueColumn: 'id',
                selectColumns: ['id', 'label'],
                where: { column: 'category', op: '=', value: 'ARMOR' }
              }]
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

    await expect(executeRelationshipPlan(dbMock, plan, { values: {} }))
      .rejects.toThrow('Untrusted node runtime table')
  })
})
