import { Stack, StackProps } from 'aws-cdk-lib'
import { createMasterResolvers } from '../resolvers/resolvers'
import type { Construct } from 'constructs'
import { GraphqlApiConstruct } from '../constructs/graphqlApi'
import type { UserPool } from 'aws-cdk-lib/aws-cognito'
import type { EntityTable } from '../resolvers/tables'

interface AdminStackProps extends StackProps {
  userPool: UserPool
}

export class AdminDomainStack extends Stack {
  public readonly adminDomainTables: EntityTable[]
  constructor(scope: Construct, id: string, props: AdminStackProps) {
    super(scope, id, props)

    const { graphqlApi } = new GraphqlApiConstruct(this, 'artk-admin-domain-graphql-api', {
      userPool: props.userPool,
      name: 'artk-admin-domain-graphql-api',
    })

    const { tables } = createMasterResolvers({ api: graphqlApi, stack: this, type: 'domain' })

    this.adminDomainTables = tables
  }
}
