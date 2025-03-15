import { Stack, StackProps, CfnOutput, App } from 'aws-cdk-lib'
import { GraphqlApi, AuthorizationType } from 'aws-cdk-lib/aws-appsync'
import { UserPool } from 'aws-cdk-lib/aws-cognito'
import { join } from 'path'
import { createResolvers } from './dnd5e2014/resolvers'
import { globSync } from 'glob'
import * as fs from 'fs'
import { Definition } from 'aws-cdk-lib/aws-appsync'

export class CdkStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props)

    // Find all relevant GraphQL files
    const typeFiles = globSync('**/types.graphql')
    const inputFiles = globSync('**/inputs.graphql')
    const queryFiles = globSync('**/queries.graphql')
    const mutationFiles = globSync('**/mutations.graphql')

    // Create the schema header
    const schemaHeader = `schema {
      query: Query
      mutation: Mutation
    }\n\n`

    // Merge the files by category
    const types = typeFiles.map((file) => fs.readFileSync(file, 'utf-8')).join('\n')
    const inputs = inputFiles.map((file) => fs.readFileSync(file, 'utf-8')).join('\n')

    // Extract and combine query fields
    const queryFields = queryFiles
      .map((file) => {
        const content = fs.readFileSync(file, 'utf-8')
        return content
          .replace(/type Query {/, '')
          .replace(/}/, '')
          .trim()
      })
      .join('\n  ')

    // Extract and combine mutation fields
    const mutationFields = mutationFiles
      .map((file) => {
        const content = fs.readFileSync(file, 'utf-8')
        return content
          .replace(/type Mutation {/, '')
          .replace(/}\s*$/, '')
          .trim()
      })
      .join('\n  ')

    // Create unified Query and Mutation types
    const unifiedTypes = `type Query {
      ${queryFields}
    }

    type Mutation {
      ${mutationFields}
    }`

    // Read and merge schema files into a single string
    const mergedSchema = `${schemaHeader}${types}\n${inputs}\n${unifiedTypes}`

    // Write the merged schema file
    const mergedSchemaPath = join(__dirname, 'schema.graphql')
    fs.writeFileSync(mergedSchemaPath, mergedSchema)

    // Create the AppSync API
    const api = new GraphqlApi(this, 'ArtificerApi', {
      name: 'artificer-toolkit-api',
      definition: Definition.fromFile(mergedSchemaPath),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: UserPool.fromUserPoolId(this, 'ArtificerToolkitUserPool', 'us-east-1_siXBHaOwk'),
          },
        },
      },
    })

    // Prints out URL
    new CfnOutput(this, 'GraphQLAPIURL', {
      value: api.graphqlUrl,
    })

    // Prints out the stack region to the terminal
    new CfnOutput(this, 'Stack Region', {
      value: this.region,
    })

    createResolvers(api, this)
  }
}
