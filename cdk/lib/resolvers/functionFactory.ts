import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { entityOperationMap } from '../schemas/entityMap'
import { capitalize } from './helper'

type MappingConfig = {
  get?: string
  list?: () => string
  create?: string
  update?: string
  delete?: string
  batchCreate?: string
}

const MAPPING_KEYS = ['batchCreate', 'create', 'update', 'delete', 'get', 'list'] as const

type FunctionConfig = {
  name: string
  dataSourceName: string
  mappingFile: string
}

export function createFunctions(api: GraphqlApi, table: Table, name: string, mappings: MappingConfig) {
  const entityRecord = entityOperationMap.find((entity) => entity.entity === name)
  const queries = entityRecord?.queries
  const mutations = entityRecord?.mutations
  if (!queries?.length || !mutations?.length) {
    throw new Error(`No queries or mutations found for ${name}`)
  }

  const opsToCreate = [...queries, ...mutations]
  const opsConfigs: Record<string, FunctionConfig> = {}

  opsToCreate.forEach((op) => {
    const opMapping = MAPPING_KEYS.find((key) => op.startsWith(key))
    if (!opMapping) {
      throw new Error(`No mapping found for ${op}`)
    }
    const capitalizedOpName = capitalize(opMapping) + op.slice(opMapping.length)
    const capitalizedOpString = capitalize(op)
    const mapping = typeof mappings[opMapping] === 'function' ? mappings[opMapping]!() : mappings[opMapping]
    if (!mapping) {
      throw new Error(`No mapping file configured for ${opMapping} (${op})`)
    }
    opsConfigs[capitalizedOpString] = {
      name: `${op}Function`,
      dataSourceName: `${name}Table${capitalizedOpName}`,
      mappingFile: mapping,
    }
  })

  const functions: Record<string, AppsyncFunction> = {}
  for (const funcName of opsToCreate) {
    const capitalizedFuncName = capitalize(funcName)
    const config = opsConfigs[capitalizedFuncName]
    if (config) {
      functions[capitalizedFuncName] = new AppsyncFunction(api, `${capitalizedFuncName}Function`, {
        name: config.name,
        api,
        dataSource: api.addDynamoDbDataSource(config.dataSourceName, table),
        code: Code.fromAsset(join(__dirname, `./jsFunctionMappings/${config.mappingFile}`)),
        runtime: FunctionRuntime.JS_1_0_0,
      })
    }
  }
  return functions
}
