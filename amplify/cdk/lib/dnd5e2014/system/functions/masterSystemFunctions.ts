import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createMasterSystemFunctions = (api: GraphqlApi, masterSystemTable: Table) => {
  return {
    listMasterSystems: new AppsyncFunction(api, 'ListMasterSystemsFunction', {
      name: 'listMasterSystemsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('MasterSystemTableList', masterSystemTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMasterMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
