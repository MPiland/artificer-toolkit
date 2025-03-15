import { Context, AppSyncIdentityCognito, util } from '@aws-appsync/utils'
import { DynamoDBQueryRequest } from '@aws-appsync/utils'

export function request(ctx: Context & { identity: AppSyncIdentityCognito }) {
  // Check if user is in Admin group
  const isAdmin =
    ctx.identity.claims &&
    ctx.identity.claims['cognito:groups'] &&
    ctx.identity.claims['cognito:groups'].includes('Admins')

  const ownerId = isAdmin ? 'master' : ctx.identity.sub

  const baseQuery: DynamoDBQueryRequest = {
    operation: 'Query',
    query: {
      expression: 'ownerId = :ownerId',
      expressionValues: util.dynamodb.toMapValues({ ':ownerId': ownerId }),
    },
    index: 'ownerIndex',
  }

  return baseQuery
}

export function response(ctx: Context) {
  return ctx.result
}
