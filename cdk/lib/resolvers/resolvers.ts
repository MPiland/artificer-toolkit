import { Stack } from 'aws-cdk-lib'
import { GraphqlApi } from 'aws-cdk-lib/aws-appsync'
import { createMasterTables, createUserTables } from './tables'
import { createTableResolvers } from './resolverFactory'

export function createUserResolvers({
  api,
  stack,
  type,
}: {
  api: GraphqlApi
  stack: Stack
  type: 'domain' | 'feature'
}) {
  const tables = createUserTables(stack, type)
  tables.forEach((table) => createTableResolvers(api, table.table, table.name))
  return { tables }
}

export function createMasterResolvers({
  api,
  stack,
  type,
}: {
  api: GraphqlApi
  stack: Stack
  type: 'domain' | 'feature'
}) {
  const tables = createMasterTables(stack, type)
  tables.forEach((table) => createTableResolvers(api, table.table, table.name))
  return { tables }
}
