import { GraphqlApi, AppsyncFunction, Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'

export const createSpellFunctions = (api: GraphqlApi, spellTable: Table) => {
  return {
    getSpell: new AppsyncFunction(api, 'GetSpellFunction', {
      name: 'getSpellFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SpellTableGet', spellTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/getItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    listSpells: new AppsyncFunction(api, 'ListSpellsFunction', {
      name: 'listSpellsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SpellTableList', spellTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/listItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    createSpell: new AppsyncFunction(api, 'CreateSpellFunction', {
      name: 'createSpellFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SpellTableCreate', spellTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/createItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    updateSpell: new AppsyncFunction(api, 'UpdateSpellFunction', {
      name: 'updateSpellFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SpellTableUpdate', spellTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/updateItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    deleteSpell: new AppsyncFunction(api, 'DeleteSpellFunction', {
      name: 'deleteSpellFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SpellTableDelete', spellTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/deleteItemMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    batchCreateSpells: new AppsyncFunction(api, 'BatchCreateSpellsFunction', {
      name: 'batchCreateSpellsFunction',
      api,
      dataSource: api.addDynamoDbDataSource('SpellTableBatchCreate', spellTable),
      code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/batchCreateItemsMapping.js')),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  }
}
