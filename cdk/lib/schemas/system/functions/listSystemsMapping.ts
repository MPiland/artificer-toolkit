import { Context, AppSyncIdentityCognito, util } from '@aws-appsync/utils'
import { DynamoDBQueryRequest } from '@aws-appsync/utils'

export function request(ctx: Context & { identity: AppSyncIdentityCognito }) {
  const {limit = 1000, nextToken }: { limit?: number; nextToken?: string } = ctx.args

  // Always use the user's sub as ownerId for regular items
  const ownerId = ctx.identity.sub

  const baseQuery: DynamoDBQueryRequest = {
    operation: 'Query',
    query: {
      expression: 'ownerId = :ownerId',
      expressionValues: util.dynamodb.toMapValues({ ':ownerId': ownerId }),
    },
    index: 'ownerIndex',
    limit: limit,
    nextToken: nextToken,
  }

  return baseQuery
}

export function response(ctx: Context) {
  const items = ctx.result.items
  return {
    items,
    nextToken: ctx.result.nextToken,
  }
}
