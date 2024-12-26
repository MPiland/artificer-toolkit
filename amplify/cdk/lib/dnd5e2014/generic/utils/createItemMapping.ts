import { Context, AppSyncIdentityCognito, util } from '@aws-appsync/utils'

export function request(ctx: Context & { identity: AppSyncIdentityCognito }) {
  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ id: util.autoId() }),
    attributeValues: util.dynamodb.toMapValues({
      ...ctx.args.input,
      ownerId: ctx.identity.sub,
    }),
  }
}

export function response(ctx: Context) {
  return ctx.result
}
