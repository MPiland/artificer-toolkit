import { UserPool, UserPoolOperation } from 'aws-cdk-lib/aws-cognito'
import { Stack } from 'aws-cdk-lib'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { join } from 'path'

export function createFunctions(stack: Stack, userPool: UserPool) {
  const postConfirmInitUser = new NodejsFunction(stack, 'PostConfirmInitUser', {
    entry: join(__dirname, 'postConfirmInitUser.ts'),
    handler: 'handler',
    runtime: Runtime.NODEJS_LATEST,
  })

  userPool.addTrigger(UserPoolOperation.POST_CONFIRMATION, postConfirmInitUser)
}
