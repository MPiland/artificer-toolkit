import { GraphqlApi, Code, FunctionRuntime, Resolver, AppsyncFunction } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
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

  // Create the functions
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

  // Create only the resolvers that are needed
  for (const opName of opsArray) {
    const capitalizedOpString = capitalize(opName)
    const config = resolverConfig[capitalizedOpString]
    if (config && functions[capitalizedOpString]) {
      const resolverId = `${opName}Resolver`
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
