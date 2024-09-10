import { a } from '@aws-amplify/backend'

export const Ability = a.model({
  name: a.string(),
  value: a.string(),
  system: a.belongsTo('System', 'id'),
})
.authorization((allow) => [allow.owner()])
