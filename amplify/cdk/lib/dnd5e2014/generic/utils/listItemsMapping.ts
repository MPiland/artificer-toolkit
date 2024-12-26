import { Context, AppSyncIdentityCognito, util } from '@aws-appsync/utils'
import { DynamoDBQueryRequest } from '@aws-appsync/utils'

export function request(ctx: Context & { identity: AppSyncIdentityCognito }) {
  const { systemId }: { systemId: string } = ctx.args

  const baseQuery: DynamoDBQueryRequest = {
    operation: 'Query',
    query: {
      expression: 'ownerId = :ownerId',
      expressionValues: util.dynamodb.toMapValues({ ':ownerId': ctx.identity.sub }),
    },
    filter: {
      expression: 'systemId = :systemId',
      expressionValues: util.dynamodb.toMapValues({
        ':systemId': systemId,
      }),
    },
    index: 'ownerIndex',
  }

  return baseQuery
}

export function response(ctx: Context) {
  return ctx.result
}
