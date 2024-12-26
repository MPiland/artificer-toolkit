interface BatchCreateInput {
  tableName: string
  data: Record<string, any>
}

import { Context, AppSyncIdentityCognito, util, DynamoDBTransactWriteItemsRequest } from '@aws-appsync/utils'

export function request(ctx: Context & { identity: AppSyncIdentityCognito }): DynamoDBTransactWriteItemsRequest {
  const transactItems = ctx.args.input.map((item: BatchCreateInput) => ({
    table: item.tableName,
    operation: 'PutItem',
    attributeValues: util.dynamodb.toMapValues({
      ...item.data,
      id: util.autoId(),
      createdAt: util.time.nowISO8601(),
      updatedAt: util.time.nowISO8601(),
      ownerId: ctx.identity.sub,
    }),
  }))

  return {
    operation: 'TransactWriteItems',
    transactItems: transactItems,
  }
}

export function response(ctx: Context) {
  return ctx.result
}
