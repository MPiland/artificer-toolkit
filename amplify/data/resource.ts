import { type ClientSchema, a, defineData } from '@aws-amplify/backend'
import { Ability } from './options'
import { System } from './systems'

const schema = a.schema({
  Ability: Ability,
  System: System,
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
})