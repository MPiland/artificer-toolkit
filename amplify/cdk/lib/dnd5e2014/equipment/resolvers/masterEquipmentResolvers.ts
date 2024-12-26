import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createMasterEquipmentFunctions } from '../functions/masterEquipmentFunctions'

export function addResolvers(api: GraphqlApi, masterEquipmentTable: Table) {
  // Create the function

  const masterEquipmentFunctions = createMasterEquipmentFunctions(api, masterEquipmentTable)

  new Resolver(api, 'ListMasterEquipmentResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listMasterEquipment',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [masterEquipmentFunctions.listMasterEquipment],
  })
}
