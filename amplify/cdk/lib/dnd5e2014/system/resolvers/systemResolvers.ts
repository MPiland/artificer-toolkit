import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createSystemFunctions } from '../functions/systemFunctions'

export function addResolvers(api: GraphqlApi, systemTable: Table) {
  // Create the function

  const systemFunctions = createSystemFunctions(api, systemTable)

  new Resolver(api, 'GetSystemResolver', {
    api,
    typeName: 'Query',
    fieldName: 'getSystem',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [systemFunctions.getSystem],
  })

  new Resolver(api, 'ListSystemsResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listSystems',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [systemFunctions.listSystems],
  })

  new Resolver(api, 'CreateSystemResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'createSystem',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [systemFunctions.createSystem],
  })

  new Resolver(api, 'UpdateSystemResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'updateSystem',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [systemFunctions.updateSystem],
  })

  new Resolver(api, 'DeleteSystemResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'deleteSystem',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [systemFunctions.deleteSystem],
  })

  new Resolver(api, 'BatchCreateSystemsResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'batchCreateSystems',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [systemFunctions.batchCreateSystems],
  })
}
