import { hashPassword } from 'better-auth/crypto'
import { convexTest } from '../tests/convexTest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internal } from './_generated/api'
import { createAuth } from './authFactory.helper'
import { redeem as redeemAction } from './authInvitationActions'
import { issue, redeem } from './authInvitations'
import { invite } from './authInvitationsCli'
import authSchema from './betterAuth/schema'
import schema from './schema'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('SITE_URL', 'http://localhost:3000')
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-that-is-long-enough')
  vi.stubEnv('PUBLIC_SIGN_UP_ENABLED', 'false')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function fixture() {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  const input = {
    email: `${crypto.randomUUID()}@example.invalid`,
    token: 'a'.repeat(64),
    username: 'InvitedReader',
    password: 'invited-password-123'
  }
  const identifier = `account-invitation:${input.email}`
  return {
    t,
    input,
    identifier,
    issue: (token = input.token) =>
      t.mutation(internal.authInvitations.issue, { email: input.email.toUpperCase(), token }),
    record: () =>
      t.run(async (ctx) =>
        (await createAuth(ctx).$context).internalAdapter.findVerificationValue(identifier)
      ),
    user: () =>
      t.run(async (ctx) =>
        (await createAuth(ctx).$context).internalAdapter.findUserByEmail(input.email, {
          includeAccounts: true
        })
      )
  }
}

describe('one-use account invitations', () => {
  it('issues privately, stores only a digest, rotates old links, and uses a fragment email link', async () => {
    const f = fixture()
    expect(
      invite.isInternal && issue.isInternal && redeem.isInternal && redeemAction.isInternal
    ).toBe(true)
    await f.issue()
    expect(await f.record()).toMatchObject({
      identifier: f.identifier,
      value: Buffer.from(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(f.input.token))
      ).toString('hex'),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    })
    expect(await f.user()).toBeNull()
    const jobs = await f.t.run((ctx) => ctx.db.system.query('_scheduled_functions').take(5))
    expect(jobs).toHaveLength(1)
    const delivery = jobs[0].args[0] as { action: string; recipient: string; actionUrl: string }
    const url = new URL(delivery.actionUrl)
    expect(delivery.action).toBe('invite')
    expect(delivery.recipient).toBe(f.input.email)
    expect(url.origin).toBe('http://localhost:3000')
    expect(url.search).toBe('?flow=invite')
    expect(new URLSearchParams(url.hash.slice(1)).get('token')).toBe(f.input.token)
    await f.issue('b'.repeat(64))
    await expect(f.t.action(internal.authInvitationActions.redeem, f.input)).rejects.toThrow(
      'invitation'
    )
    expect(await f.user()).toBeNull()
  })

  it('creates one verified ordinary account and credential, consumes the link, and leaves signup closed', async () => {
    const f = fixture()
    await f.issue()
    await f.t.action(internal.authInvitationActions.redeem, f.input)
    const created = await f.user()
    expect(created?.user).toMatchObject({ email: f.input.email, emailVerified: true, role: 'user' })
    expect(created?.accounts).toHaveLength(1)
    const credential = created!.accounts[0]
    expect(credential.providerId).toBe('credential')
    expect(credential.password).not.toBe(f.input.password)
    await f.t.run(async (ctx) => {
      const { password } = await createAuth(ctx).$context
      expect(
        await password.verify({ hash: credential.password!, password: f.input.password })
      ).toBe(true)
    })
    const profiles = await f.t.run((ctx) =>
      ctx.db.query('userProfiles').withIndex('by_authUserId').take(2)
    )
    expect(profiles).toHaveLength(1)
    expect(profiles[0].registrationCompleted).toBe(true)
    expect(profiles[0].userId).toMatch(/^[a-f0-9-]{36}$/)
    expect(await f.record()).toBeNull()
    await expect(f.t.action(internal.authInvitationActions.redeem, f.input)).rejects.toThrow(
      'invitation'
    )
    await expect(f.issue()).rejects.toThrow('already exists')
    await expect(
      f.t.run((ctx) =>
        createAuth(ctx).api.signUpEmail({
          body: {
            email: 'not-invited@example.invalid',
            username: 'AnotherReader',
            name: 'AnotherReader',
            password: f.input.password
          }
        })
      )
    ).rejects.toThrow('not enabled')
  })

  it('rejects invalid, expired and wrong-recipient links without creating a user', async () => {
    const f = fixture()
    await f.issue()
    for (const patch of [
      { token: '0'.repeat(64) },
      { token: 'malformed' },
      { email: 'different@example.invalid' },
      { username: 'bad name' },
      { password: 'short' }
    ]) {
      await expect(
        f.t.action(internal.authInvitationActions.redeem, { ...f.input, ...patch })
      ).rejects.toThrow()
    }
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000)
    await expect(f.t.action(internal.authInvitationActions.redeem, f.input)).rejects.toThrow(
      'invitation'
    )
    expect(await f.user()).toBeNull()
    expect(await f.t.run((ctx) => ctx.db.query('userProfiles').take(1))).toEqual([])
  })

  // The invitation signs up through the public options, so it runs the sign-up moderation hook.
  it('refuses a blocked username, keeps the invitation and creates no user', async () => {
    const f = fixture()
    await f.issue()
    const before = await f.record()
    await expect(
      f.t.action(internal.authInvitationActions.redeem, { ...f.input, username: 'assmuncher' })
    ).rejects.toThrow()
    expect(await f.user()).toBeNull()
    expect(await f.record()).toEqual(before)
    expect(await f.t.run((ctx) => ctx.db.query('userProfiles').take(1))).toEqual([])
    await expect(f.t.action(internal.authInvitationActions.redeem, f.input)).resolves.toBeNull()
  })

  it('rolls back account, credential, profile and consumption after a late abort', async () => {
    const f = fixture()
    await f.issue()
    const before = await f.record()
    const passwordHash = await hashPassword(f.input.password)
    await expect(
      f.t.run(async (ctx) => {
        await ctx.runMutation(internal.authInvitations.redeem, { ...f.input, passwordHash })
        const { internalAdapter, password } = await createAuth(ctx).$context
        const created = await internalAdapter.findUserByEmail(f.input.email, {
          includeAccounts: true
        })
        const credential = created?.accounts[0]
        expect(credential?.password).toBe(passwordHash)
        expect(
          await password.verify({ hash: credential!.password!, password: f.input.password })
        ).toBe(true)
        throw new Error('injected late abort')
      })
    ).rejects.toThrow('injected late abort')
    expect(await f.user()).toBeNull()
    expect(await f.record()).toEqual(before)
    expect(await f.t.run((ctx) => ctx.db.query('userProfiles').take(1))).toEqual([])
    await expect(f.t.action(internal.authInvitationActions.redeem, f.input)).resolves.toBeNull()
  })

  it('preserves the invitation and existing account when a username is already taken', async () => {
    const f = fixture()
    await f.issue()
    await f.t.action(internal.authInvitationActions.redeem, f.input)
    const otherEmail = 'other-invite@example.invalid'
    await f.t.mutation(internal.authInvitations.issue, { email: otherEmail, token: f.input.token })
    await expect(
      f.t.action(internal.authInvitationActions.redeem, {
        ...f.input,
        email: otherEmail,
        username: f.input.username.toUpperCase()
      })
    ).rejects.toThrow()
    expect((await f.user())?.user.emailVerified).toBe(true)
    await expect(
      f.t.action(internal.authInvitationActions.redeem, {
        ...f.input,
        email: otherEmail,
        username: 'DifferentReader'
      })
    ).resolves.toBeNull()
  })
})
