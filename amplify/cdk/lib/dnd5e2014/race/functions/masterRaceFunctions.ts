import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createMasterRaceFunctions = (api: GraphqlApi, masterRaceTable: Table) => {
  return {
    listMasterRaces: new AppsyncFunction(api, 'ListMasterRacesFunction', {
      name: 'listMasterRacesFunction',
      api,
      dataSource: api.addDynamoDbDataSource('MasterRaceTableList', masterRaceTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMasterMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
