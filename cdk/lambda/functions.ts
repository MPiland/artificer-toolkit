import { Duration, Stack } from 'aws-cdk-lib'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { join } from 'path'
import type { UserPool } from 'aws-cdk-lib/aws-cognito'
import type { EntityTable } from '../lib/resolvers/tables'

export function createFunctions({
	stack,
	userTables,
	adminTables,
	userPool,
	type,
}: {
	stack: Stack
	userTables: EntityTable[]
	adminTables: EntityTable[]
	userPool: UserPool
	type: 'domain' | 'feature'
}) {
	const env: Record<string, string> = {}

	for (const { name, table } of userTables) {
		env[`${name.toUpperCase()}_TABLE_NAME`] = table.tableName
	}

	for (const { name, table } of adminTables) {
		env[`${name.toUpperCase()}_TABLE_NAME`] = table.tableName
	}

	env.USER_POOL_ID = userPool.userPoolId
	env.type = type

	const initUserData = new NodejsFunction(stack, 'InitUserData', {
		entry: join(__dirname, 'initUserData.ts'),
		handler: 'handler',
		runtime: Runtime.NODEJS_LATEST,
		timeout: Duration.seconds(120),
		retryAttempts: 0,
		environment: env,
	})

	userTables.forEach(({ table }) => table.grantReadWriteData(initUserData))

	adminTables.forEach(({ table }) => table.grantReadData(initUserData))

	const actions = ['cognito-idp:AdminGetUser', 'cognito-idp:AdminUpdateUserAttributes']

	userPool.grant(initUserData, ...actions)

	return { initUserData }
}
