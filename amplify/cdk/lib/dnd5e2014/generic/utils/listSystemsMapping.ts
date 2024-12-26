import { Context, AppSyncIdentityCognito, util } from '@aws-appsync/utils'
import { DynamoDBQueryRequest } from '@aws-appsync/utils'

export function request(ctx: Context & { identity: AppSyncIdentityCognito }) {
  const { limit, nextToken }: { limit?: number; nextToken?: string; systemId: string } = ctx.args

  const baseQuery: DynamoDBQueryRequest = {
    operation: 'Query',
    query: {
      expression: 'ownerId = :ownerId',
      expressionValues: util.dynamodb.toMapValues({ ':ownerId': ctx.identity.sub }),
    },
    index: 'ownerIndex',
  }

  if (limit) {
    baseQuery.limit = limit
    if (nextToken) {
      baseQuery.nextToken = nextToken
    }
  }

  return baseQuery
}

export function response(ctx: Context) {
  const { items, nextToken } = ctx.result
  return { items, nextToken }
}
