import { Context } from '@aws-appsync/utils'

export function request() {
  return {}
}

export function response(ctx: Context) {
  const { dieCount, dieValue }: { dieCount: number; dieValue: number } = ctx.source
  return `${dieCount}d${dieValue}`
}
