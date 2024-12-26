import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createMasterRaceFunctions } from '../functions/masterRaceFunctions'

export function addResolvers(api: GraphqlApi, masterRaceTable: Table) {
  // Create the function

  const masterRacesFunctions = createMasterRaceFunctions(api, masterRaceTable)

  new Resolver(api, 'ListMasterRacesResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listMasterRaces',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [masterRacesFunctions.listMasterRaces],
  })
}
