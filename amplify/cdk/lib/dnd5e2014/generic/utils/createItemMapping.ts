import { Context, AppSyncIdentityCognito, util } from '@aws-appsync/utils'

export function request(ctx: Context & { identity: AppSyncIdentityCognito }) {
  // Check if user is in Admin group
  const isAdmin =
    ctx.identity.claims &&
    ctx.identity.claims['cognito:groups'] &&
    ctx.identity.claims['cognito:groups'].includes('Admins')

  const ownerId = isAdmin ? 'master' : ctx.identity.sub

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ id: util.autoId() }),
    attributeValues: util.dynamodb.toMapValues({
      ...ctx.args.input,
      ownerId: ownerId,
    }),
  }
}

export function response(ctx: Context) {
  return ctx.result
}
