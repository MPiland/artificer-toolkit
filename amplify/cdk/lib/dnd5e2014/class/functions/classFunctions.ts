import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createClassFunctions = (api: GraphqlApi, classTable: Table) => {
  return {
    getClass: new AppsyncFunction(api, 'GetClassFunction', {
      name: 'getClassFunction',
      api,
      dataSource: api.addDynamoDbDataSource('ClassTableGet', classTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/getItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    listClasses: new AppsyncFunction(api, 'ListClassesFunction', {
      name: 'listClassesFunction',
      api,
      dataSource: api.addDynamoDbDataSource('ClassTableList', classTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    createClass: new AppsyncFunction(api, 'CreateClassFunction', {
      name: 'createClassFunction',
      api,
      dataSource: api.addDynamoDbDataSource('ClassTableCreate', classTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/createItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    updateClass: new AppsyncFunction(api, 'UpdateClassFunction', {
      name: 'updateClassFunction',
      api,
      dataSource: api.addDynamoDbDataSource('ClassTableUpdate', classTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/updateItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    deleteClass: new AppsyncFunction(api, 'DeleteClassFunction', {
      name: 'deleteClassFunction',
      api,
      dataSource: api.addDynamoDbDataSource('ClassTableDelete', classTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/deleteItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    batchCreateClasses: new AppsyncFunction(api, 'BatchCreateClassesFunction', {
      name: 'batchCreateClassesFunction',
      api,
      dataSource: api.addDynamoDbDataSource('ClassTableBatchCreate', classTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/batchCreateItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
