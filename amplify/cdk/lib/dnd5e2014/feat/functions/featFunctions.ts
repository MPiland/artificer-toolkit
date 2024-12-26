import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createFeatFunctions = (api: GraphqlApi, featTable: Table) => {
  return {
    getFeat: new AppsyncFunction(api, 'GetFeatFunction', {
      name: 'getFeatFunction',
      api,
      dataSource: api.addDynamoDbDataSource('FeatTableGet', featTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/getItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    listFeats: new AppsyncFunction(api, 'ListFeatsFunction', {
      name: 'listFeatsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('FeatTableList', featTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    createFeat: new AppsyncFunction(api, 'CreateFeatFunction', {
      name: 'createFeatFunction',
      api,
      dataSource: api.addDynamoDbDataSource('FeatTableCreate', featTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/createItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    updateFeat: new AppsyncFunction(api, 'UpdateFeatFunction', {
      name: 'updateFeatFunction',
      api,
      dataSource: api.addDynamoDbDataSource('FeatTableUpdate', featTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/updateItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    deleteFeat: new AppsyncFunction(api, 'DeleteFeatFunction', {
      name: 'deleteFeatFunction',
      api,
      dataSource: api.addDynamoDbDataSource('FeatTableDelete', featTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/deleteItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    batchCreateFeats: new AppsyncFunction(api, 'BatchCreateFeatsFunction', {
      name: 'batchCreateFeatsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('FeatTableBatchCreate', featTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/batchCreateItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
