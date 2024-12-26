import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createBackgroundFunctions } from '../functions/backgroundFunctions'

export function addResolvers(api: GraphqlApi, backgroundTable: Table) {
  // Create the function

  const backgroundFunctions = createBackgroundFunctions(api, backgroundTable)

  new Resolver(api, 'GetBackgroundResolver', {
    api,
    typeName: 'Query',
    fieldName: 'getBackground',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [backgroundFunctions.getBackground],
  })

  new Resolver(api, 'ListBackgroundsResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listBackgrounds',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [backgroundFunctions.listBackgrounds],
  })

  new Resolver(api, 'CreateBackgroundResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'createBackground',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [backgroundFunctions.createBackground],
  })

  new Resolver(api, 'UpdateBackgroundResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'updateBackground',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [backgroundFunctions.updateBackground],
  })

  new Resolver(api, 'DeleteBackgroundResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'deleteBackground',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [backgroundFunctions.deleteBackground],
  })

  new Resolver(api, 'BatchCreateBackgroundsResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'batchCreateBackgrounds',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [backgroundFunctions.batchCreateBackgrounds],
  })
}
