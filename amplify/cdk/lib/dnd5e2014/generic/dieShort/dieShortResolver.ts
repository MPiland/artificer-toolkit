import { GraphqlApi, Code, FunctionRuntime, Resolver } from 'aws-cdk-lib/aws-appsync'
import { join } from 'path'

export const addResolvers = (api: GraphqlApi, typeName: string) => {
  new Resolver(api, `${typeName}DieShortResolver`, {
    api,
    typeName,
    fieldName: 'dieShort',
    dataSource: api.addNoneDataSource(`${typeName}DieShortDS`),
    code: Code.fromAsset(join(__dirname, '../../jsFunctionMappings/dieShortFunctionMapping.js')),
    runtime: FunctionRuntime.JS_1_0_0,
  })
}
