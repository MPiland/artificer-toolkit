import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createMasterBackgroundFunctions } from '../functions/masterBackgroundFunctions'

export function addResolvers(api: GraphqlApi, masterBackgroundTable: Table) {
  // Create the function

  const masterBackgroundsFunctions = createMasterBackgroundFunctions(api, masterBackgroundTable)

  new Resolver(api, 'ListMasterBackgroundsResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listMasterBackgrounds',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [masterBackgroundsFunctions.listMasterBackgrounds],
  })
}
