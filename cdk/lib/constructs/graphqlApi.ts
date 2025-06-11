#!/usr/bin/env node
import { StackProps, CfnOutput } from 'aws-cdk-lib'
import { type UserPool } from 'aws-cdk-lib/aws-cognito'
import { Construct } from 'constructs'
import { AuthorizationType, Definition, GraphqlApi } from 'aws-cdk-lib/aws-appsync'

interface GraphqlApiConstructProps extends StackProps {
  userPool: UserPool
  name: string
}

export class GraphqlApiConstruct extends Construct {
  readonly graphqlApi: GraphqlApi
  constructor(scope: Construct, id: string, props: GraphqlApiConstructProps) {
    super(scope, id)

    this.graphqlApi = new GraphqlApi(this, 'artk-graphql-api', {
      name: props.name,
      definition: Definition.fromFile('./lib/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: props.userPool,
          },
        },
      },
    })

    new CfnOutput(this, 'GraphqlApiUrl', {
      value: this.graphqlApi.graphqlUrl,
    })
  }
}
