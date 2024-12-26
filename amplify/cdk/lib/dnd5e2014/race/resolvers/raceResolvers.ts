import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createRaceFunctions } from '../functions/raceFunctions'

export function addResolvers(api: GraphqlApi, raceTable: Table) {
  // Create the function

  const raceFunctions = createRaceFunctions(api, raceTable)

  new Resolver(api, 'GetRaceResolver', {
    api,
    typeName: 'Query',
    fieldName: 'getRace',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [raceFunctions.getRace],
  })

  new Resolver(api, 'ListRacesResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listRaces',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [raceFunctions.listRaces],
  })

  new Resolver(api, 'CreateRaceResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'createRace',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [raceFunctions.createRace],
  })

  new Resolver(api, 'UpdateRaceResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'updateRace',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [raceFunctions.updateRace],
  })

  new Resolver(api, 'DeleteRaceResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'deleteRace',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [raceFunctions.deleteRace],
  })

  new Resolver(api, 'BatchCreateRacesResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'batchCreateRaces',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [raceFunctions.batchCreateRaces],
  })
}
