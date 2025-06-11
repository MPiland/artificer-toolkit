#!/usr/bin/env node
import { Stack, StackProps } from 'aws-cdk-lib'
import { createUserResolvers } from '../resolvers/resolvers'
import type { Construct } from 'constructs'
import type { UserPool } from 'aws-cdk-lib/aws-cognito'
import { createFunctions } from '../../lambda/functions'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpApiConstruct } from '../constructs/httpApi'
import { GraphqlApiConstruct } from '../constructs/graphqlApi'
import type { EntityTable } from '../resolvers/tables'

interface UserStackProps extends StackProps {
  userPool: UserPool
  adminTables: EntityTable[]
}

export class UserDomainStack extends Stack {
  constructor(scope: Construct, id: string, props: UserStackProps) {
    super(scope, id, props)

    const { httpApi } = new HttpApiConstruct(this, 'artk-user-domain-http-api')

    const { graphqlApi } = new GraphqlApiConstruct(this, 'artk-user-domain-graphql-api', {
      userPool: props.userPool,
      name: 'artk-user-domain-graphql-api',
    })

    const { tables } = createUserResolvers({ api: graphqlApi, stack: this, type: 'domain' })

    const { initUserData } = createFunctions({
      stack: this,
      userTables: tables,
      adminTables: props.adminTables,
      userPool: props.userPool,
    })

    const InitUserDataApi = new HttpLambdaIntegration('init-user-domain-data-api', initUserData)

    httpApi.addRoutes({
      path: '/init-user-domain-data',
      methods: [HttpMethod.POST],
      integration: InitUserDataApi,
    })
  }
}
