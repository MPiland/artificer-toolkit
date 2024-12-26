import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createCharacterFunctions } from '../functions/characterFunctions'

export function addResolvers(api: GraphqlApi, characterTable: Table) {
  // Create the function

  const characterFunctions = createCharacterFunctions(api, characterTable)

  new Resolver(api, 'GetCharacterResolver', {
    api,
    typeName: 'Query',
    fieldName: 'getCharacter',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [characterFunctions.getCharacter],
  })

  new Resolver(api, 'ListCharactersResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listCharacters',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [characterFunctions.listCharacters],
  })

  new Resolver(api, 'CreateCharacterResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'createCharacter',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [characterFunctions.createCharacter],
  })

  new Resolver(api, 'UpdateCharacterResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'updateCharacter',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [characterFunctions.updateCharacter],
  })

  new Resolver(api, 'DeleteCharacterResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'deleteCharacter',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [characterFunctions.deleteCharacter],
  })
}
