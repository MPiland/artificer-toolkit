import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createMasterSpellFunctions } from '../functions/masterSpellFunctions'

export function addResolvers(api: GraphqlApi, masterSpellTable: Table) {
  // Create the function

  const masterSpellsFunctions = createMasterSpellFunctions(api, masterSpellTable)

  new Resolver(api, 'ListMasterSpellsResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listMasterSpells',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [masterSpellsFunctions.listMasterSpells],
  })
}
