import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createRaceFunctions = (api: GraphqlApi, raceTable: Table) => {
  return {
    getRace: new AppsyncFunction(api, 'GetRaceFunction', {
      name: 'getRaceFunction',
      api,
      dataSource: api.addDynamoDbDataSource('RaceTableGet', raceTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/getItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    listRaces: new AppsyncFunction(api, 'ListRacesFunction', {
      name: 'listRacesFunction',
      api,
      dataSource: api.addDynamoDbDataSource('RaceTableList', raceTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    createRace: new AppsyncFunction(api, 'CreateRaceFunction', {
      name: 'createRaceFunction',
      api,
      dataSource: api.addDynamoDbDataSource('RaceTableCreate', raceTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/createItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    updateRace: new AppsyncFunction(api, 'UpdateRaceFunction', {
      name: 'updateRaceFunction',
      api,
      dataSource: api.addDynamoDbDataSource('RaceTableUpdate', raceTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/updateItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    deleteRace: new AppsyncFunction(api, 'DeleteRaceFunction', {
      name: 'deleteRaceFunction',
      api,
      dataSource: api.addDynamoDbDataSource('RaceTableDelete', raceTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/deleteItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    batchCreateRaces: new AppsyncFunction(api, 'BatchCreateRacesFunction', {
      name: 'batchCreateRacesFunction',
      api,
      dataSource: api.addDynamoDbDataSource('RaceTableBatchCreate', raceTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/batchCreateItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
