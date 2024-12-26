import { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  return {
    operation: 'DeleteItem',
    key: {
      id: ctx.args.input.id,
    },
  }
}

export function response(ctx: Context) {
  return ctx.args.input.id
}
