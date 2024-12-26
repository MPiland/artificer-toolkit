import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createMasterSpellFunctions = (api: GraphqlApi, masterSpellTable: Table) => {
  return {
    listMasterSpells: new AppsyncFunction(api, 'ListMasterSpellsFunction', {
      name: 'listMasterSpellsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('MasterSpellTableList', masterSpellTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMasterMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
