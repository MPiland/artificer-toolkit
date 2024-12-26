import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createBackgroundFunctions = (api: GraphqlApi, backgroundTable: Table) => {
  return {
    getBackground: new AppsyncFunction(api, 'GetBackgroundFunction', {
      name: 'getBackgroundFunction',
      api,
      dataSource: api.addDynamoDbDataSource('BackgroundTableGet', backgroundTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/getItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    listBackgrounds: new AppsyncFunction(api, 'ListBackgroundsFunction', {
      name: 'listBackgroundsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('BackgroundTableList', backgroundTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    createBackground: new AppsyncFunction(api, 'CreateBackgroundFunction', {
      name: 'createBackgroundFunction',
      api,
      dataSource: api.addDynamoDbDataSource('BackgroundTableCreate', backgroundTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/createItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    updateBackground: new AppsyncFunction(api, 'UpdateBackgroundFunction', {
      name: 'updateBackgroundFunction',
      api,
      dataSource: api.addDynamoDbDataSource('BackgroundTableUpdate', backgroundTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/updateItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    deleteBackground: new AppsyncFunction(api, 'DeleteBackgroundFunction', {
      name: 'deleteBackgroundFunction',
      api,
      dataSource: api.addDynamoDbDataSource('BackgroundTableDelete', backgroundTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/deleteItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    batchCreateBackgrounds: new AppsyncFunction(api, 'BatchCreateBackgroundsFunction', {
      name: 'batchCreateBackgroundsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('BackgroundTableBatchCreate', backgroundTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/batchCreateItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
