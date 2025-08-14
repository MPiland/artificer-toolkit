import { Context, AppSyncIdentityCognito, util } from '@aws-appsync/utils'
import { DynamoDBQueryRequest } from '@aws-appsync/utils'
import {  metaData, itemsToMeta } from './util'

export function request(ctx: Context & { identity: AppSyncIdentityCognito }) {
  const { systemId, limit = 1000, nextToken }: { systemId: string; limit?: number; nextToken?: string } = ctx.args

  // Always use the user's sub as ownerId for regular items
  const ownerId = ctx.identity.sub

  const baseQuery: DynamoDBQueryRequest = {
    operation: 'Query',
    query: {
      expression: 'ownerId = :ownerId',
      expressionValues: util.dynamodb.toMapValues({ ':ownerId': ownerId }),
    },
    filter: {
      expression: 'systemId = :systemId',
      expressionValues: util.dynamodb.toMapValues({
        ':systemId': systemId,
      }),
    },
    index: 'ownerIndex',
    limit: limit,
    nextToken: nextToken,
  }

  return baseQuery
}

export function response(ctx: Context) {
  const items = ctx.result.items
  itemsToMeta(items)
  return {
    items,
    metaData,
    nextToken: ctx.result.nextToken,
  }
}
