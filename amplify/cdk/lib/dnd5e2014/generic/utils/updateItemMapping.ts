import { Context } from '@aws-appsync/utils'
import { util } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const { id, ...values } = ctx.args.input

  const condition = {
    id: { attributeExists: true },
  }
  return dynamodbUpdateRequest({ keys: { id }, values, condition })
}

/**
 * Helper function to update an item
 * @returns an UpdateItem request
 */
function dynamodbUpdateRequest(params: {
  keys: { id: string }
  values: { [key: string]: any }
  condition: { id: { attributeExists: boolean } }
}) {
  const { keys, values, condition: inCondObj } = params

  const sets: string[] = []
  const removes: string[] = []
  const expressionNames: { [key: string]: string } = {}
  const expValues: { [key: string]: any } = {}

  // Iterate through the keys of the values
  for (const [key, value] of Object.entries(values)) {
    expressionNames[`#${key}`] = key
    if (value) {
      sets.push(`#${key} = :${key}`)
      expValues[`:${key}`] = value
    } else {
      removes.push(`#${key}`)
    }
  }

  let expression = sets.length ? `SET ${sets.join(', ')}` : ''
  expression += removes.length ? ` REMOVE ${removes.join(', ')}` : ''

  const condition = JSON.parse(util.transform.toDynamoDBConditionExpression(inCondObj))

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues(keys),
    condition,
    update: {
      expression,
      expressionNames,
      expressionValues: util.dynamodb.toMapValues(expValues),
    },
  }
}

export function response(ctx: Context) {
  return ctx.result
}
