import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createEquipmentFunctions = (api: GraphqlApi, equipmentTable: Table) => {
  return {
    getEquipment: new AppsyncFunction(api, 'GetEquipmentFunction', {
      name: 'getEquipmentFunction',
      api,
      dataSource: api.addDynamoDbDataSource('EquipmentTableGet', equipmentTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/getItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    listEquipment: new AppsyncFunction(api, 'ListEquipmentFunction', {
      name: 'listEquipmentFunction',
      api,
      dataSource: api.addDynamoDbDataSource('EquipmentTableList', equipmentTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    createEquipment: new AppsyncFunction(api, 'CreateEquipmentFunction', {
      name: 'createEquipmentFunction',
      api,
      dataSource: api.addDynamoDbDataSource('EquipmentTableCreate', equipmentTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/createItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    updateEquipment: new AppsyncFunction(api, 'UpdateEquipmentFunction', {
      name: 'updateEquipmentFunction',
      api,
      dataSource: api.addDynamoDbDataSource('EquipmentTableUpdate', equipmentTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/updateItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    deleteEquipment: new AppsyncFunction(api, 'DeleteEquipmentFunction', {
      name: 'deleteEquipmentFunction',
      api,
      dataSource: api.addDynamoDbDataSource('EquipmentTableDelete', equipmentTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/deleteItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    batchCreateEquipment: new AppsyncFunction(api, 'BatchCreateEquipmentFunction', {
      name: 'batchCreateEquipmentFunction',
      api,
      dataSource: api.addDynamoDbDataSource('EquipmentTableBatchCreate', equipmentTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/batchCreateItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
