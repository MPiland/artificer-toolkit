import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createSpellFunctions } from '../functions/spellFunctions'

export function addResolvers(api: GraphqlApi, spellTable: Table) {
  // Create the function

  const spellFunctions = createSpellFunctions(api, spellTable)

  new Resolver(api, 'GetSpellResolver', {
    api,
    typeName: 'Query',
    fieldName: 'getSpell',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [spellFunctions.getSpell],
  })

  new Resolver(api, 'ListSpellsResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listSpells',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [spellFunctions.listSpells],
  })

  new Resolver(api, 'CreateSpellResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'createSpell',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [spellFunctions.createSpell],
  })

  new Resolver(api, 'UpdateSpellResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'updateSpell',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [spellFunctions.updateSpell],
  })

  new Resolver(api, 'DeleteSpellResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'deleteSpell',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [spellFunctions.deleteSpell],
  })

  new Resolver(api, 'BatchCreateSpellsResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'batchCreateSpells',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [spellFunctions.batchCreateSpells],
  })
}
