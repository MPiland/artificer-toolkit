import { type ClientSchema, a, defineData } from '@aws-amplify/backend'
import { Ability, System } from './systems'

const schema = a.schema({
  System: System,
  Ability: Ability,
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
})
