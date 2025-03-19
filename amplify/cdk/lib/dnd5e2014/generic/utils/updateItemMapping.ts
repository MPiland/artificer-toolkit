import { Context } from '@aws-appsync/utils'
import { util } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const input = ctx.args.input

  // Instead of appendError, use console.log for debugging
  console.log('Processing update for item:', input.id)

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ id: input.id }),
    attributeValues: util.dynamodb.toMapValues(input),
    condition: {
      expression: 'attribute_exists(id)',
    },
  }
}

export function response(ctx: Context) {
  // Only handle actual errors
  if (ctx.error) {
    // For conditional check failures (item doesn't exist)
    if (ctx.error.message && ctx.error.message.includes('ConditionalCheckFailedException')) {
      util.error('Item does not exist', 'ConditionError')
    }

    // For all other errors, pass through with minimal processing
    util.error(ctx.error.message || 'Unknown error occurred', ctx.error.type || 'InternalError')
  }

  return ctx.result
}
