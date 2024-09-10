import { a } from '@aws-amplify/backend'

export const System = a
  .model({
    name: a.string(),
    value: a.string(),
    desc: a.string(),
    abilities: a.ref('Ability').array(),
  })
  .authorization((allow) => [allow.owner()])

export const Ability = a.customType({
  name: a.string(),
  value: a.string(),
  shortName: a.string(),
  desc: a.string(),
  tooltip: a.string(),
})
