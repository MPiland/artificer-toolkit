import { Context } from '@aws-appsync/utils'

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
  return {
    items,
    nextToken: ctx.result.nextToken,
  }
}
