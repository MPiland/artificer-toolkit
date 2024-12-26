import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createMasterFeatFunctions } from '../functions/masterFeatFunctions'

export function addResolvers(api: GraphqlApi, masterFeatTable: Table) {
  // Create the function

  const masterFeatsFunctions = createMasterFeatFunctions(api, masterFeatTable)

  new Resolver(api, 'ListMasterFeatsResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listMasterFeats',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [masterFeatsFunctions.listMasterFeats],
  })
}
