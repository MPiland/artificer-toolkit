import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createMasterClassFunctions = (api: GraphqlApi, masterClassTable: Table) => {
  return {
    listMasterClasses: new AppsyncFunction(api, 'ListMasterClassesFunction', {
      name: 'listMasterClassesFunction',
      api,
      dataSource: api.addDynamoDbDataSource('MasterClassTableList', masterClassTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMasterMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
