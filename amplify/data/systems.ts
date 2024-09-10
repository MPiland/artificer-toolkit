import { a } from '@aws-amplify/backend'

export const System = a
  .model({
    name: a.string(),
    value: a.string(),
    desc: a.string(),
    abilities: a.customType({
        name: a.string(),
        value: a.string()
    }).array(),
  })
  .authorization((allow) => [allow.owner()])
