import { createEmailVerificationToken } from 'better-auth/api'
import { createFunctionHandle } from 'convex/server'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthOptions } from './authFactory.helper'
import { api, components, internal } from './_generated/api'
import schema from './schema'
import authSchema from './betterAuth/schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

const t = convexTest(schema, import.meta.glob('./**/*.*s'))

t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))

async function createAuthUser(withProfile: boolean) {
  return await t.run(async (ctx) => {
    const onCreateHandle = withProfile
      ? await createFunctionHandle(internal.auth.onCreate)
      : undefined

    return await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Test User',
          email: `test-${crypto.randomUUID()}@example.com`,
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle
    })
  })
}

async function createSession(userId: string) {
  return await t.run(
    async (ctx) =>
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'session',
          data: {
            userId,
            token: crypto.randomUUID(),
            expiresAt: Date.now() + 60_000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
  )
}

function clearFeatureFlags() {
  delete process.env.LIBRARY_IMPORT_ENABLED
  delete process.env.PUBLIC_SIGN_UP_ENABLED
}

beforeEach(clearFeatureFlags)
afterEach(clearFeatureFlags)

describe('Convex identity foundation', () => {
  it('sends signup and sign-in verification links to the native confirmation landing', async () => {
    await t.run(async (ctx) => {
      const options = createAuthOptions(ctx)
      const scheduled = vi
        .spyOn(ctx.scheduler, 'runAfter')
        .mockRejectedValue(new Error('Captured delivery'))
      try {
        expect(options.emailVerification.autoSignInAfterVerification).toBe(false)
        expect(options.emailVerification.sendOnSignIn).toBe(true)
        expect(options.emailAndPassword.disableSignUp).toBe(true)
        const token = await createEmailVerificationToken(
          process.env.BETTER_AUTH_SECRET!,
          'unverified@example.invalid'
        )
        for (const callback of ['/', '/home']) {
          await expect(
            options.emailVerification.sendVerificationEmail({
              user: {
                id: 'test-user',
                name: 'Unverified user',
                email: 'unverified@example.invalid',
                emailVerified: false,
                createdAt: new Date(),
                updatedAt: new Date()
              },
              token,
              url: `http://localhost:3000/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent(callback)}`
            })
          ).rejects.toThrow('Captured delivery')
          expect(scheduled).toHaveBeenLastCalledWith(0, internal.email.send, {
            action: 'signup',
            recipient: 'unverified@example.invalid',
            actionUrl: `http://localhost:3000/api/auth/verify-email?token=${token}&callbackURL=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fconfirmed`
          })
        }
      } finally {
        scheduled.mockRestore()
      }
    })
  })
  it('denies an anonymous identity request', async () => {
    await expect(t.query(api.account.identity, {})).rejects.toThrow('Unauthenticated')
    await expect(t.query(api.account.session, {})).resolves.toEqual({
      user: null,
      featureFlags: { libraryImportEnabled: false, publicSignUpEnabled: false },
      isSuperAdmin: false
    })
    await expect(
      t.mutation(api.account.setAuthoringExperience, {
        experience: 'advanced'
      })
    ).rejects.toThrow('Unauthenticated')
  })

  it('projects only the caller profile and persists preferences only for that caller', async () => {
    const userA = await createAuthUser(true)
    const sessionA = await createSession(userA._id)
    const userB = await createAuthUser(true)
    const sessionB = await createSession(userB._id)
    const callerA = t.withIdentity({
      subject: userA._id,
      sessionId: sessionA._id
    })
    const callerB = t.withIdentity({
      subject: userB._id,
      sessionId: sessionB._id
    })
    const identityA = await callerA.query(api.account.identity, {})
    const identityB = await callerB.query(api.account.identity, {})

    expect(
      (
        await t
          .withIdentity({ subject: userA._id, sessionId: sessionB._id })
          .query(api.account.session, {})
      ).user
    ).toBeNull()
    expect((await callerA.query(api.account.session, {})).user).toEqual({
      ...identityA,
      email: userA.email,
      username: null,
      registrationCompleted: true,
      authoringExperience: 'guided'
    })
    await callerA.mutation(api.account.setAuthoringExperience, {
      experience: 'advanced'
    })
    expect((await callerA.query(api.account.session, {})).user?.authoringExperience).toBe(
      'advanced'
    )
    expect((await callerB.query(api.account.session, {})).user?.authoringExperience).toBe('guided')
    await expect(
      callerA.mutation(api.account.setAuthoringExperience, {
        experience: 'advanced',
        ...{ userId: identityB.userId }
      })
    ).rejects.toThrow()
    expect((await callerB.query(api.account.session, {})).user?.authoringExperience).toBe('guided')
  })

  it('returns only the app UUID and role for an authenticated profile', async () => {
    const user = await createAuthUser(true)
    const session = await createSession(user._id)

    await expect(
      t.withIdentity({ subject: user._id, sessionId: session._id }).query(api.account.identity, {})
    ).resolves.toEqual({
      userId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      ),
      role: 'user'
    })
  })

  it('rejects a missing profile and a revoked session', async () => {
    const userWithoutProfile = await createAuthUser(false)
    const validSession = await createSession(userWithoutProfile._id)

    await expect(
      t
        .withIdentity({
          subject: userWithoutProfile._id,
          sessionId: validSession._id
        })
        .query(api.account.identity, {})
    ).rejects.toThrow('profile is missing')

    const userWithProfile = await createAuthUser(true)
    const revokedSession = await createSession(userWithProfile._id)

    await t.run(
      async (ctx) =>
        await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
          input: {
            model: 'session',
            where: [{ field: '_id', operator: 'eq', value: revokedSession._id }]
          }
        })
    )

    await expect(
      t
        .withIdentity({
          subject: userWithProfile._id,
          sessionId: revokedSession._id
        })
        .query(api.account.identity, {})
    ).rejects.toThrow('Unauthenticated')
    expect(
      (
        await t
          .withIdentity({
            subject: userWithProfile._id,
            sessionId: revokedSession._id
          })
          .query(api.account.session, {})
      ).user
    ).toBeNull()
  })

  it('defaults application feature flags to closed', async () => {
    await expect(t.query(api.application.featureFlags, {})).resolves.toEqual({
      libraryImportEnabled: false,
      publicSignUpEnabled: false
    })
  })

  it('reads and updates only the authenticated profile with no private auth fields', async () => {
    const userA = await createAuthUser(true)
    const sessionA = await createSession(userA._id)
    const userB = await createAuthUser(true)
    const sessionB = await createSession(userB._id)
    const callerA = t.withIdentity({
      subject: userA._id,
      sessionId: sessionA._id
    })
    const callerB = t.withIdentity({
      subject: userB._id,
      sessionId: sessionB._id
    })

    await expect(t.query(api.account.profile, {})).rejects.toThrow('Unauthenticated')
    await expect(
      t.mutation(api.account.updateProfile, {
        username: 'MapReader',
        bio: null
      })
    ).rejects.toThrow('Unauthenticated')
    await expect(callerA.query(api.account.profile, {})).resolves.toEqual({
      username: null,
      bio: null
    })
    await expect(
      callerA.mutation(api.account.updateProfile, {
        username: ' MapReader ',
        bio: '  Hello!  '
      })
    ).resolves.toEqual({ username: 'MapReader', bio: 'Hello!' })
    await expect(callerA.query(api.account.profile, {})).resolves.toEqual({
      username: 'MapReader',
      bio: 'Hello!'
    })
    await expect(callerB.query(api.account.profile, {})).resolves.toEqual({
      username: null,
      bio: null
    })
    const storedUser = await t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'user',
        where: [{ field: '_id', value: userA._id }]
      })
    )
    expect(storedUser).toMatchObject({
      username: 'mapreader',
      displayUsername: 'MapReader'
    })
    await expect(callerA.mutation(api.account.updateProfile, { bio: '  ' })).resolves.toEqual({
      username: 'MapReader',
      bio: null
    })
    expect((await callerA.query(api.account.session, {})).user?.username).toBe('MapReader')
  })

  it('rejects profile impersonation, role injection, invalid fields, and revoked sessions', async () => {
    const user = await createAuthUser(true)
    const session = await createSession(user._id)
    const caller = t.withIdentity({
      subject: user._id,
      sessionId: session._id,
      role: 'superadmin'
    })
    expect((await caller.query(api.account.identity, {})).role).toBe('user')
    await expect(
      // @ts-expect-error An untyped client must not select another account's profile.
      caller.query(api.account.profile, { ...{ userId: crypto.randomUUID() } })
    ).rejects.toThrow()
    for (const extra of [
      { userId: crypto.randomUUID() },
      { role: 'superadmin' },
      { email: 'other@example.invalid' }
    ]) {
      await expect(
        caller.mutation(api.account.updateProfile, {
          username: 'QuietReader',
          bio: null,
          ...extra
        })
      ).rejects.toThrow()
    }
    for (const input of [
      { username: 'admin', bio: null },
      { username: 'bad name', bio: null },
      { username: 'QuietReader', bio: 'x'.repeat(501) }
    ]) {
      await expect(caller.mutation(api.account.updateProfile, input)).rejects.toThrow()
    }
    await expect(caller.query(api.account.profile, {})).resolves.toEqual({
      username: null,
      bio: null
    })
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: 'session',
          where: [{ field: '_id', value: session._id }]
        }
      })
    )
    await expect(caller.query(api.account.profile, {})).rejects.toThrow('Unauthenticated')
    await expect(
      caller.mutation(api.account.updateProfile, {
        username: 'QuietReader',
        bio: null
      })
    ).rejects.toThrow('Unauthenticated')
  })

  it('rejects a case-insensitive username collision without changing either profile', async () => {
    const userA = await createAuthUser(true)
    const sessionA = await createSession(userA._id)
    const userB = await createAuthUser(true)
    const sessionB = await createSession(userB._id)
    const callerA = t.withIdentity({
      subject: userA._id,
      sessionId: sessionA._id
    })
    const callerB = t.withIdentity({
      subject: userB._id,
      sessionId: sessionB._id
    })
    await callerA.mutation(api.account.updateProfile, {
      username: 'RiverScout',
      bio: 'First'
    })
    await callerB.mutation(api.account.updateProfile, {
      username: 'ForestScout',
      bio: 'Second'
    })
    await expect(
      callerB.mutation(api.account.updateProfile, {
        username: 'RIVERSCOUT',
        bio: 'Must not persist'
      })
    ).rejects.toThrow()
    await expect(callerA.query(api.account.profile, {})).resolves.toEqual({
      username: 'RiverScout',
      bio: 'First'
    })
    await expect(callerB.query(api.account.profile, {})).resolves.toEqual({
      username: 'ForestScout',
      bio: 'Second'
    })
    await expect(
      callerA.mutation(api.account.updateProfile, {
        username: 'RIVERSCOUT',
        bio: 'Same owner'
      })
    ).resolves.toEqual({ username: 'RIVERSCOUT', bio: 'Same owner' })
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: userB._id }],
          update: { displayUsername: 'RiverScout' }
        }
      })
    )
    await expect(
      callerB.mutation(api.account.updateProfile, {
        username: 'RiverScout',
        bio: 'Must not persist'
      })
    ).rejects.toThrow()
    expect((await callerB.query(api.account.profile, {})).bio).toBe('Second')
  })

  it('rolls back the auth username and profile bio when the transaction aborts after writing', async () => {
    const user = await createAuthUser(true)
    const session = await createSession(user._id)
    const caller = t.withIdentity({
      subject: user._id,
      sessionId: session._id
    })
    await caller.mutation(api.account.updateProfile, {
      username: 'DeltaReader',
      bio: 'Before'
    })

    await expect(
      caller.run(async (ctx) => {
        await ctx.runMutation(api.account.updateProfile, {
          username: 'HarborReader',
          bio: 'After'
        })
        throw new Error('Injected transaction abort')
      })
    ).rejects.toThrow('Injected transaction abort')

    await expect(caller.query(api.account.profile, {})).resolves.toEqual({
      username: 'DeltaReader',
      bio: 'Before'
    })
    const storedUser = await t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'user',
        where: [{ field: '_id', value: user._id }]
      })
    )
    expect(storedUser).toMatchObject({
      username: 'deltareader',
      displayUsername: 'DeltaReader'
    })
  })
})
