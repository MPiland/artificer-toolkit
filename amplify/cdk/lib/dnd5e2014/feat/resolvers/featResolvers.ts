import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createFeatFunctions } from '../functions/featFunctions'

export function addResolvers(api: GraphqlApi, featTable: Table) {
  // Create the function

  const featFunctions = createFeatFunctions(api, featTable)

  new Resolver(api, 'GetFeatResolver', {
    api,
    typeName: 'Query',
    fieldName: 'getFeat',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [featFunctions.getFeat],
  })

  new Resolver(api, 'ListFeatsResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listFeats',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [featFunctions.listFeats],
  })

  new Resolver(api, 'CreateFeatResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'createFeat',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [featFunctions.createFeat],
  })

  new Resolver(api, 'UpdateFeatResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'updateFeat',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [featFunctions.updateFeat],
  })

  new Resolver(api, 'DeleteFeatResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'deleteFeat',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [featFunctions.deleteFeat],
  })

  new Resolver(api, 'BatchCreateFeatsResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'batchCreateFeats',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [featFunctions.batchCreateFeats],
  })
}
