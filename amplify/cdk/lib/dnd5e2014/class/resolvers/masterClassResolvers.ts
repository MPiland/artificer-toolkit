import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createMasterClassFunctions } from '../functions/masterClassFunctions'

export function addResolvers(api: GraphqlApi, masterClassTable: Table) {
  // Create the function

  const masterClassFunctions = createMasterClassFunctions(api, masterClassTable)

  new Resolver(api, 'ListMasterClassesResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listMasterClasses',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [masterClassFunctions.listMasterClasses],
  })
}
