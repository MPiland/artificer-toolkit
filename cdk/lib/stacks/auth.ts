#!/usr/bin/env node
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib'
import { StringAttribute, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito'
import type { Construct } from 'constructs'

export class AuthStack extends Stack {
  readonly userPool: UserPool
  readonly userPoolClient: UserPoolClient
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const userPool = new UserPool(this, 'artk-user-pool', {
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      signInAliases: { email: true },
      customAttributes: {
        init_domain_data: new StringAttribute({ mutable: true }),
        init_feature_data: new StringAttribute({ mutable: true }),
      },
    })

    this.userPool = userPool

    const userPoolClient = new UserPoolClient(this, 'artk-user-pool-client', {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      enableTokenRevocation: true,
      preventUserExistenceErrors: true,
    })

    this.userPoolClient = userPoolClient

    new CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    })

    // Prints out the stack region to the terminal
    new CfnOutput(this, 'StackRegion', {
      value: this.region,
    })
  }
}
