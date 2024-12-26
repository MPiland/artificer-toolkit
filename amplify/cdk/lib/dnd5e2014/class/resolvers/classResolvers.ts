import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createClassFunctions } from '../functions/classFunctions'

export function addResolvers(api: GraphqlApi, classTable: Table) {
  // Create the function

  const classFunctions = createClassFunctions(api, classTable)

  new Resolver(api, 'GetClassResolver', {
    api,
    typeName: 'Query',
    fieldName: 'getClass',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [classFunctions.getClass],
  })

  new Resolver(api, 'ListClassesResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listClasses',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [classFunctions.listClasses],
  })

  new Resolver(api, 'CreateClassResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'createClass',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [classFunctions.createClass],
  })

  new Resolver(api, 'UpdateClassResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'updateClass',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [classFunctions.updateClass],
  })

  new Resolver(api, 'DeleteClassResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'deleteClass',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [classFunctions.deleteClass],
  })

  new Resolver(api, 'BatchCreateClassesResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'batchCreateClasses',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [classFunctions.batchCreateClasses],
  })
}
