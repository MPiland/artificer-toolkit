import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { join } from 'path'
import { createEquipmentFunctions } from '../functions/equipmentFunctions'

export function addResolvers(api: GraphqlApi, equipmentTable: Table) {
  // Create the function

  const equipmentFunctions = createEquipmentFunctions(api, equipmentTable)

  new Resolver(api, 'GetEquipmentResolver', {
    api,
    typeName: 'Query',
    fieldName: 'getEquipment',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [equipmentFunctions.getEquipment],
  })

  new Resolver(api, 'ListEquipmentResolver', {
    api,
    typeName: 'Query',
    fieldName: 'listEquipment',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [equipmentFunctions.listEquipment],
  })

  new Resolver(api, 'CreateEquipmentResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'createEquipment',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [equipmentFunctions.createEquipment],
  })

  new Resolver(api, 'UpdateEquipmentResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'updateEquipment',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [equipmentFunctions.updateEquipment],
  })

  new Resolver(api, 'DeleteEquipmentResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'deleteEquipment',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [equipmentFunctions.deleteEquipment],
  })

  new Resolver(api, 'BatchCreateEquipmentResolver', {
    api,
    typeName: 'Mutation',
    fieldName: 'batchCreateEquipment',
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/resolverMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
    pipelineConfig: [equipmentFunctions.batchCreateEquipment],
  })
}
