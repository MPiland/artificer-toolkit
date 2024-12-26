import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createCharacterFunctions = (api: GraphqlApi, characterTable: Table) => {
  return {
    getCharacter: new AppsyncFunction(api, 'GetCharacterFunction', {
      name: 'getCharacterFunction',
      api,
      dataSource: api.addDynamoDbDataSource('CharacterTableGet', characterTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/getItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    listCharacters: new AppsyncFunction(api, 'ListCharactersFunction', {
      name: 'listCharactersFunction',
      api,
      dataSource: api.addDynamoDbDataSource('CharacterTableList', characterTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    createCharacter: new AppsyncFunction(api, 'CreateCharacterFunction', {
      name: 'createCharacterFunction',
      api,
      dataSource: api.addDynamoDbDataSource('CharacterTableCreate', characterTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/createItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    updateCharacter: new AppsyncFunction(api, 'UpdateCharacterFunction', {
      name: 'updateCharacterFunction',
      api,
      dataSource: api.addDynamoDbDataSource('CharacterTableUpdate', characterTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/updateItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    deleteCharacter: new AppsyncFunction(api, 'DeleteCharacterFunction', {
      name: 'deleteCharacterFunction',
      api,
      dataSource: api.addDynamoDbDataSource('CharacterTableDelete', characterTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/deleteItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
