import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createSystemFunctions = (api: GraphqlApi, systemTable: Table) => {
  return {
    getSystem: new AppsyncFunction(api, 'GetSystemFunction', {
      name: 'getSystemFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SystemTableGet', systemTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/getItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    listSystems: new AppsyncFunction(api, 'ListSystemsFunction', {
      name: 'listSystemsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SystemTableList', systemTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listSystemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    createSystem: new AppsyncFunction(api, 'CreateSystemFunction', {
      name: 'createSystemFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SystemTableCreate', systemTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/createItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    updateSystem: new AppsyncFunction(api, 'UpdateSystemFunction', {
      name: 'updateSystemFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SystemTableUpdate', systemTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/updateItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    deleteSystem: new AppsyncFunction(api, 'DeleteSystemFunction', {
      name: 'deleteSystemFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SystemTableDelete', systemTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/deleteItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    batchCreateSystems: new AppsyncFunction(api, 'BatchCreateSystemsFunction', {
      name: 'batchCreateSystemsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SystemTableBatchCreate', systemTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/batchCreateItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
