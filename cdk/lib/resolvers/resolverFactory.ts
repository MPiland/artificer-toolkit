import { GraphqlApi, Code, FunctionRuntime, Resolver, AppsyncFunction } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { Function as LambdaFunction, Runtime, Code as LambdaCode } from 'aws-cdk-lib/aws-lambda'
import { join } from 'path'
import { createFunctions } from './functionFactory'
import { entityOperationMap } from '../schemas/entityMap'
import { capitalize } from './helper'

export type FunctionRecord = Record<string, AppsyncFunction>

type ResolverConfig = {
  name: string
  typeName: string
  fieldName: string
}

const listMappingsByPrefix: Partial<Record<string, string>> = {
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
  MasterSystem: 'listSystemsMasterMapping.js',
  System: 'listSystemsMapping.js',
}

// Operations that need Lambda aggregation (user domain only)
const LAMBDA_GET_OPERATIONS = [
  'getClass',
  'getRace',
  'getBackground',
  'getEquipment',
  'getFeat',
  'getAncestryOption',
  'getFeatureOption',
  'getFeature',
]
const LAMBDA_UPDATE_OPERATIONS = [
  'updateClass',
  'updateRace',
  'updateBackground',
  'updateEquipment',
  'updateFeat',
  'updateAncestryOption',
  'updateFeatureOption',
  'updateFeature',
]

const defaultMasterMapping = 'listItemsMasterMapping.js'
const defaultMapping = 'listItemsMapping.js'

export function createTableResolvers(api: GraphqlApi, table: Table, name: string) {
  const entityRecord = entityOperationMap.find((entity) => entity.entity === name)
  const queries = entityRecord?.queries
  const mutations = entityRecord?.mutations
  if (!queries?.length || !mutations?.length) {
    throw new Error(`No queries or mutations found for ${name}`)
  }
  const opsToCreate = { queries: [...queries], mutations: [...mutations] }
  const isMaster = name.includes('Master')

  // Create the functions for standard DynamoDB operations
  const functions = createFunctions(api, table, name, {
    get: 'getItemMapping.js',
    list: () => listMappingsByPrefix[name] ?? (isMaster ? defaultMasterMapping : defaultMapping),
    create: 'createItemMapping.js',
    update: 'updateItemMapping.js',
    delete: 'deleteItemMapping.js',
    batchCreate: 'batchCreateItemsMapping.js',
  })

  // Common resolver code path
  const resolverCodePath = join(__dirname, './jsFunctionMappings/resolverMapping.js')
  const resolverConfig: Record<string, ResolverConfig> = {}

  const opsCategories = ['queries', 'mutations'] as const

  // Type-safe loop over queries and mutations
  opsCategories.forEach((type) => {
    opsToCreate[type].forEach((op) => {
      const capitalizedOpString = capitalize(op)
      resolverConfig[capitalizedOpString] = {
        name: capitalizedOpString,
        typeName: type === 'queries' ? 'Query' : 'Mutation',
        fieldName: op,
      }
    })
  })

  const opsArray = [...opsToCreate.queries, ...opsToCreate.mutations]

  // Create resolvers
  for (const opName of opsArray) {
    const capitalizedOpString = capitalize(opName)
    const config = resolverConfig[capitalizedOpString]

    if (!config) continue

    const resolverId = `${opName}Resolver`

    // Check if this operation needs Lambda aggregation
    if (!isMaster && LAMBDA_GET_OPERATIONS.includes(opName)) {
      // Create Lambda data source for this operation
      const lambdaDataSource = createLambdaGetDataSource(api, table, config, name)

      // Create resolver using Lambda data source
      new Resolver(api, resolverId, {
        api,
        typeName: config.typeName,
        fieldName: config.fieldName,
        dataSource: lambdaDataSource,
      })
    } else if (!isMaster && LAMBDA_UPDATE_OPERATIONS.includes(opName)) {
      // Create Lambda data source for this operation
      const lambdaDataSource = createLambdaUpdateDataSource(api, table, config, name)

      // Create resolver using Lambda data source
      new Resolver(api, resolverId, {
        api,
        typeName: config.typeName,
        fieldName: config.fieldName,
        dataSource: lambdaDataSource,
      })
    } else if (functions[capitalizedOpString]) {
      // Use standard DynamoDB resolver with pipeline functions
      new Resolver(api, resolverId, {
        api,
        typeName: config.typeName,
        fieldName: config.fieldName,
        code: Code.fromAsset(resolverCodePath),
        runtime: FunctionRuntime.JS_1_0_0,
        pipelineConfig: [functions[capitalizedOpString]],
      })
    }
  }
}

function createLambdaGetDataSource(api: GraphqlApi, table: Table, config: ResolverConfig, entityName: string) {
  // Create Lambda function for this specific entity
  const lambdaGetFunction = new LambdaFunction(api, `${config.fieldName}Lambda`, {
    runtime: Runtime.NODEJS_18_X,
    handler: 'getData.handler',
    code: LambdaCode.fromAsset(join(__dirname, '../../lambda')),
    environment: {
      // Pass the specific table name for this entity
      [`${entityName.toUpperCase()}_TABLE`]: table.tableName,
      // TODO: Add feature table names as needed
    },
  })

  // Grant permissions to the main table
  table.grantReadData(lambdaGetFunction)

  // Create and return Lambda data source
  return api.addLambdaDataSource(`${config.fieldName}DataSource`, lambdaGetFunction)
}

function createLambdaUpdateDataSource(api: GraphqlApi, table: Table, config: ResolverConfig, entityName: string) {
  // Create Lambda function for this specific entity
  const lambdaUpdateFunction = new LambdaFunction(api, `${config.fieldName}Lambda`, {
    runtime: Runtime.NODEJS_18_X,
    handler: 'updateData.handler',
    code: LambdaCode.fromAsset(join(__dirname, '../../lambda')),
    environment: {
      // Pass the specific table name for this entity
      [`${entityName.toUpperCase()}_TABLE`]: table.tableName,
      // TODO: Add feature table names as needed
    },
  })

  // Grant permissions to the main table
  table.grantReadWriteData(lambdaUpdateFunction)

  // Create and return Lambda data source
  return api.addLambdaDataSource(`${config.fieldName}DataSource`, lambdaUpdateFunction)
}
