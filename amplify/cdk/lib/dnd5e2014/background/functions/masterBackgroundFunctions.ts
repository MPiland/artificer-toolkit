import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createMasterBackgroundFunctions = (api: GraphqlApi, masterBackgroundTable: Table) => {
  return {
    listMasterBackgrounds: new AppsyncFunction(api, 'ListMasterBackgroundsFunction', {
      name: 'listMasterBackgroundsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('MasterBackgroundTableList', masterBackgroundTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMasterMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
