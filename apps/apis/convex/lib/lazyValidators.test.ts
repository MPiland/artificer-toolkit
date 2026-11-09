import { expect, it } from 'vitest'
import { convexTest } from '../../tests/convexTest'
import { api, internal } from '../_generated/api'
import schema from '../schema'

// The builders hand Convex `args` as getters it reads only on export. convex-test validates every call
// against the exported validators, as a deployed backend does, so these calls fail before any handler
// runs. It does not check return validators, so no test here can prove a return rejection.
const backend = () => convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))

it('rejects a public query call that is missing an argument', async () => {
  await expect(
    // @ts-expect-error The call omits the required `encounterId`.
    backend().query(api.encounters.actionChoices.get, { expectedVersion: 1, actorId: 'actor' })
  ).rejects.toThrow('Validator error: Missing required field `encounterId`')
})

it('rejects a public mutation call with a wrong-typed argument', async () => {
  await expect(
    backend().mutation(api.encounters.runs.deletePrepared, {
      // @ts-expect-error The campaign id must be a string.
      campaignId: 42,
      encounterId: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      expectedVersion: 1
    })
  ).rejects.toThrow('Validator error: Expected `string`, got `42`')
})

it('rejects an internal mutation call with a wrong-typed argument', async () => {
  await expect(
    // @ts-expect-error The auth user id must be a string.
    backend().mutation(internal.accountDeletion.schedule, { authUserId: 42 })
  ).rejects.toThrow('Validator error: Expected `string`, got `42`')
})
