import { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  return {
    operation: 'Scan',
    limit: ctx.args.limit || 1000,
    nextToken: ctx.args.nextToken,
  }
}

export function response(ctx: Context) {
  return ctx.result.items
}
