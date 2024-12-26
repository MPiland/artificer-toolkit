import { defineFunction } from '@aws-amplify/backend'

export const initUserData = defineFunction({
  name: 'initUserData',
  entry: './handler.ts',
  timeoutSeconds: 120,
})
