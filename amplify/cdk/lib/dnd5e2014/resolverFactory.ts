import { GraphqlApi, Code, FunctionRuntime, Resolver, AppsyncFunction } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { pluralize, validateFunctions, tableToFunctionsMap, operations } from './helper'
import { createFunctions } from './functionFactory'
import type { Prefix } from './resolvers'

// Define a record type for the functions
export type FunctionRecord = Record<string, AppsyncFunction>

const listMappingsByPrefix: Partial<Record<Prefix, string>> = {
  MasterSpell: 'listSpellsMasterMapping.js',
  Spell: 'listSpellsMapping.js',
  MasterRace: 'listRacesMasterMapping.js',
  Race: 'listRacesMapping.js',
  MasterEquipment: 'listEquipmentMasterMapping.js',
  Equipment: 'listEquipmentMapping.js',
  MasterClass: 'listClassesMasterMapping.js',
  Class: 'listClassesMapping.js',
  MasterFeat: 'listFeatsMasterMapping.js',
  Feat: 'listFeatsMapping.js',
  MasterBackground: 'listBackgroundsMasterMapping.js',
  Background: 'listBackgroundsMapping.js',
}

const defaultMasterMapping = 'listItemsMasterMapping.js'
const defaultMapping = 'listItemsMapping.js'

export function createTableResolvers(api: GraphqlApi, table: Table, prefix: Prefix) {
  const isMaster = prefix.includes('Master')
  // Create the functions
  const functions = createFunctions(api, table, prefix, {
    getMapping: 'getItemMapping.js',
    listMapping: () => listMappingsByPrefix[prefix] ?? (isMaster ? defaultMasterMapping : defaultMapping),
    createMapping: 'createItemMapping.js',
    updateMapping: 'updateItemMapping.js',
    deleteMapping: 'deleteItemMapping.js',
    batchCreateMapping: 'batchCreateItemsMapping.js',
  })
  const pluralPrefix = pluralize(prefix)

  // Validate that all required functions exist
  validateFunctions(functions, prefix)

  // Common resolver code path
  const resolverCodePath = join(__dirname, './jsFunctionMappings/resolverMapping.js')

  // Get the list of functions to create resolvers for
  const functionsToCreate = tableToFunctionsMap[prefix] || Object.values(operations(prefix))

  // Define resolver configurations
  const resolverConfigs = {
    [`Get${prefix}`]: {
      typeName: 'Query',
      fieldName: `get${prefix}`,
    },
    [`List${pluralPrefix}`]: {
      typeName: 'Query',
      fieldName: `list${pluralPrefix}`,
    },
    [`Create${prefix}`]: {
      typeName: 'Mutation',
      fieldName: `create${prefix}`,
    },
    [`Update${prefix}`]: {
      typeName: 'Mutation',
      fieldName: `update${prefix}`,
    },
    [`Delete${prefix}`]: {
      typeName: 'Mutation',
      fieldName: `delete${prefix}`,
    },
    [`BatchCreate${pluralPrefix}`]: {
      typeName: 'Mutation',
      fieldName: `batchCreate${pluralPrefix}`,
    },
  }

  // Create only the resolvers that are needed
  for (const funcName of functionsToCreate) {
    const config = resolverConfigs[funcName]
    if (config && functions[funcName]) {
      // Create a resolver ID that matches your original format
      const resolverId = `${funcName}Resolver`

      new Resolver(api, resolverId, {
        api,
        typeName: config.typeName,
        fieldName: config.fieldName,
        code: Code.fromAsset(resolverCodePath),
        runtime: FunctionRuntime.JS_1_0_0,
        pipelineConfig: [functions[funcName]],
      })
    }
  }
}
