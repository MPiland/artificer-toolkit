import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createMasterEquipmentFunctions = (api: GraphqlApi, masterEquipmentTable: Table) => {
  return {
    listMasterEquipment: new AppsyncFunction(api, 'ListMasterEquipmentFunction', {
      name: 'listMasterEquipmentFunction',
      api,
      dataSource: api.addDynamoDbDataSource('MasterEquipmentTableList', masterEquipmentTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMasterMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
