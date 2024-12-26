import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createMasterFeatFunctions = (api: GraphqlApi, masterFeatTable: Table) => {
  return {
    listMasterFeats: new AppsyncFunction(api, 'ListMasterFeatsFunction', {
      name: 'listMasterFeatsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('MasterFeatTableList', masterFeatTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMasterMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
