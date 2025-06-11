#!/usr/bin/env node
import { App } from 'aws-cdk-lib'
import { AuthStack } from '../lib/stacks/auth'
import { UserDomainStack } from '../lib/stacks/userDomain'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { AdminDomainStack } from '../lib/stacks/adminDomain'
import { AdminFeatureStack } from '../lib/stacks/adminFeature'
import { UserFeatureStack } from '../lib/stacks/userFeature'

const app = new App()

const envName = app.node.tryGetContext('env')
const envs = app.node.tryGetContext('environments')

if (!envs || !envs[envName]) {
  throw new Error(`Environment '${envName}' is not defined in cdk.json context.environments`)
}

const envConfig = envs[envName]

const env = {
  account: envConfig.account,
  region: envConfig.region,
}

export type StorageTables = Record<string, Table>

const authStack = new AuthStack(app, 'artk-auth-stack', {
  env,
})

const adminDomainStack = new AdminDomainStack(app, 'artk-admin-domain-stack', {
  env,
  userPool: authStack.userPool,
})

const adminFeatureStack = new AdminFeatureStack(app, 'artk-admin-feature-stack', {
  env,
  userPool: authStack.userPool,
})

new UserDomainStack(app, 'artk-user-domain-stack', {
  env,
  userPool: authStack.userPool,
  adminTables: adminDomainStack.adminDomainTables,
})

new UserFeatureStack(app, 'artk-user-feature-stack', {
  env,
  userPool: authStack.userPool,
  adminTables: adminFeatureStack.adminFeatureTables,
})
