import { Context } from '@aws-appsync/utils'
import { metaData, itemsToMeta } from './utils/util'

export function request(ctx: Context) {
  const { limit = 1000, nextToken } = ctx.args

  return {
    operation: 'Scan',
    limit: limit,
    nextToken: nextToken,
  }
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
