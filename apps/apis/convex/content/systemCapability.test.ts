import { createFunctionHandle } from 'convex/server'
import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import { gameSystemRuleCapabilityDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { installedGameSystemRuleCapabilities } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { api, components, internal } from '../_generated/api'
import schema from '../schema'
import authSchema from '../betterAuth/schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const installed = gameSystemRuleCapabilityDtoSchema.parse(installedGameSystemRuleCapabilities[0])

async function fixture() {
  const t = convexTest(schema, modules)
  t.registerComponent('betterAuth', authSchema, import.meta.glob('../betterAuth/**/*.*s'))
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'System reader',
          email: 'system-reader@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: 'system-reader-session',
          expiresAt: Date.now() + 60000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  return { t, user, session, caller: t.withIdentity({ subject: user._id, sessionId: session._id }) }
}

describe('native System capability', () => {
  it('requires an actual authenticated session', async () => {
    const { t, user, session } = await fixture()
    const input = { id: installed.gameSystemId }
    await expect(t.query(api.content.systems.capability, input)).rejects.toThrow('Unauthenticated')
    await expect(
      t.withIdentity({ subject: user._id }).query(api.content.systems.capability, input)
    ).rejects.toThrow()
    await expect(
      t
        .withIdentity({ subject: installed.gameSystemId, sessionId: session._id })
        .query(api.content.systems.capability, input)
    ).rejects.toThrow()
  })

  it('returns only the exact installed shared contract and null for an uninstalled System', async () => {
    const { caller } = await fixture()
    expect(
      await caller.query(api.content.systems.capability, { id: installed.gameSystemId })
    ).toEqual(installed)
    expect(
      await caller.query(api.content.systems.capability, {
        id: '11111111-1111-4111-8111-111111111111'
      })
    ).toBeNull()
    await expect(
      caller.query(api.content.systems.capability, { id: 'not-a-uuid' })
    ).rejects.toThrow()
  })

  it('publishes the content kinds the System offers, from the installed contract', async () => {
    const { caller } = await fixture()
    const published = await caller.query(api.content.systems.capability, {
      id: installed.gameSystemId
    })
    expect(published?.contentKinds).toEqual(installed.contentKinds)
    expect(published?.contentKinds).toEqual(
      expect.arrayContaining(['SPELL', 'CLASS', 'RACE', 'CREATURE'])
    )
  })

  it('rejects an expired session', async () => {
    const { t, session, caller } = await fixture()
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'session',
          where: [{ field: '_id', value: session._id }],
          update: { expiresAt: Date.now() - 1000 }
        }
      })
    )
    await expect(
      caller.query(api.content.systems.capability, { id: installed.gameSystemId })
    ).rejects.toThrow('Unauthenticated')
  })
})
