import { Stack } from 'aws-cdk-lib'
import { createTable } from './tableFactory'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { entityOperationMap } from '../schemas/entityMap'

export function createEntityTable(stack: Stack, prefix: string): Table {
  const isMaster = prefix.includes('Master')
  const tableName = `${prefix}Table`

  // Add owner index only for non-master tables
  return createTable(stack, {
    name: tableName,
    addOwnerIndex: !isMaster,
  })
}

export interface EntityTable {
  name: string
  table: Table
}

export function createUserTables(stack: Stack, type: 'domain' | 'feature'): EntityTable[] {
  const tables: EntityTable[] = []
  entityOperationMap.forEach((entityOp) => {
    if (!entityOp.entity.includes('Master')) {
      if (type === 'domain' && !entityOp.entity.includes('Feature')) {
        tables.push({ name: entityOp.entity, table: createEntityTable(stack, entityOp.entity) })
      }
      if (type === 'feature' && entityOp.entity.includes('Feature')) {
        tables.push({ name: entityOp.entity, table: createEntityTable(stack, entityOp.entity) })
      }
    }
  })
  return tables
}

export function createMasterTables(stack: Stack, type: 'domain' | 'feature'): EntityTable[] {
  const tables: EntityTable[] = []
  entityOperationMap.forEach((entityOp) => {
    if (entityOp.entity.includes('Master')) {
      if (type === 'domain' && !entityOp.entity.includes('Feature')) {
        tables.push({ name: entityOp.entity, table: createEntityTable(stack, entityOp.entity) })
      }
      if (type === 'feature' && entityOp.entity.includes('Feature')) {
        tables.push({ name: entityOp.entity, table: createEntityTable(stack, entityOp.entity) })
      }
    }
  })
  return tables
}
