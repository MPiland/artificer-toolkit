import defineBackend from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { initUserData } from './functions/initUserData/initUserData'
import { Policy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam'
import { Stack } from 'aws-cdk-lib'

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  initUserData,
})

const policy = new Policy(Stack.of(backend.initUserData.resources.lambda), 'InitUserDataPolicy', {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'dynamodb:ListTables',
        'dynamodb:PutItem',
        'dynamodb:GetItem',
        'dynamodb:BatchWriteItem',
        'dynamodb:Scan',
      ],
      resources: ['*'],
    }),
  ],
})

backend.initUserData.resources.lambda.role?.attachInlinePolicy(policy)
