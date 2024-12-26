import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createMasterSystemFunctions } from '../functions/masterSystemFunctions'

export function addResolvers(api: GraphqlApi, masterSystemTable: Table) {
  // Create the function

  const masterSystemsFunctions = createMasterSystemFunctions(api, masterSystemTable)

  new Resolver(api, 'ListMasterSystemsResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listMasterSystems',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [masterSystemsFunctions.listMasterSystems],
  })
}
