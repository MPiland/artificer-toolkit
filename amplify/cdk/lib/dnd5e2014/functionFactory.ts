import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { operations, pluralize, tableToFunctionsMap } from './helper'

type MappingConfig = {
  getMapping?: string
  listMapping?: string
  createMapping?: string
  updateMapping?: string
  deleteMapping?: string
  batchCreateMapping?: string
}

// Define a configuration type for function creation
type FunctionConfig = {
  name: string
  dataSourceName: string
  mappingFile: string
}

export function createFunctions(api: GraphqlApi, table: Table, prefix: string, mappings: MappingConfig) {
  const pluralPrefix = pluralize(prefix)

  // Get the list of functions to create for this table
  const functionsToCreate = tableToFunctionsMap[prefix] || Object.values(operations(prefix))

  // Define configuration objects for each function type
  const functionConfigs: Record<string, FunctionConfig> = {
    [`Get${prefix}`]: {
      name: `get${prefix}Function`,
      dataSourceName: `${prefix}TableGet`,
      mappingFile: mappings.getMapping || 'getItemMapping.js',
    },
    [`List${pluralPrefix}`]: {
      name: `list${pluralPrefix}Function`,
      dataSourceName: `${prefix}TableList`,
      mappingFile: mappings.listMapping || 'listSystemsMapping.js',
    },
    [`Create${prefix}`]: {
      name: `create${prefix}Function`,
      dataSourceName: `${prefix}TableCreate`,
      mappingFile: mappings.createMapping || 'createItemMapping.js',
    },
    [`Update${prefix}`]: {
      name: `update${prefix}Function`,
      dataSourceName: `${prefix}TableUpdate`,
      mappingFile: mappings.updateMapping || 'updateItemMapping.js',
    },
    [`Delete${prefix}`]: {
      name: `delete${prefix}Function`,
      dataSourceName: `${prefix}TableDelete`,
      mappingFile: mappings.deleteMapping || 'deleteItemMapping.js',
    },
    [`BatchCreate${pluralPrefix}`]: {
      name: `batchCreate${pluralPrefix}Function`,
      dataSourceName: `${prefix}TableBatchCreate`,
      mappingFile: mappings.batchCreateMapping || 'batchCreateItemsMapping.js',
    },
  }

  // Create only the functions that are needed
  const functions: Record<string, AppsyncFunction> = {}

  for (const funcName of functionsToCreate) {
    const config = functionConfigs[funcName]
    if (config) {
      functions[funcName] = new AppsyncFunction(api, `${funcName}Function`, {
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
