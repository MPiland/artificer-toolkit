import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { convexTest } from '../tests/convexTest'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { describe, expect, it, vi } from 'vitest'
import type { AccountDeleteInput } from '@artificer-toolkit/schema/api/account'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { TableNames } from './_generated/dataModel'
import { publicationFixture, importedSubject } from '../tests/fixtures/publication'
import {
  advanceAccountDeletion,
  deleteAccountCompletely,
  drainScheduledWork,
  runAccountDeletionStep
} from '../tests/fixtures/accountDeletion'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { api, components, internal } from './_generated/api'
import { createAuth } from './authFactory.helper'
import authSchema from './betterAuth/schema'
import schema from './schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

const confirmCredentials = makeFunctionReference<'mutation', AccountDeleteInput, null>(
  'accountDeletion:confirmCredentials'
)

const execute = makeFunctionReference<
  'mutation',
  { sessionToken: string; command: AccountDeleteInput },
  null
>('accountDeletion:execute')

const executeWithActorId = makeFunctionReference<
  'mutation',
  { sessionToken: string; command: AccountDeleteInput & { actorId: string } },
  null
>('accountDeletion:execute')

async function fixture() {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  const password = 'Local-account-delete-confirmation-8175!'
  const hash = await t.run(async (ctx) => (await createAuth(ctx).$context).password.hash(password))
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Deletion confirmation proof',
          email: `${crypto.randomUUID()}@example.invalid`,
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const credential = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'account',
        data: {
          accountId: user._id,
          providerId: 'credential',
          userId: user._id,
          password: hash,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  return {
    t,
    user,
    credential,
    session,
    hash,
    password,
    input: { email: user.email, currentPassword: password },
    caller: t.withIdentity({ subject: user._id, sessionId: session._id }),
    snapshot: () =>
      t.run(async (ctx) => ({
        user: await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: 'user',
          where: [{ field: '_id', value: user._id }]
        }),
        credentials: await ctx.runQuery(components.betterAuth.adapter.findMany, {
          model: 'account',
          where: [{ field: 'userId', value: user._id }],
          paginationOpts: { cursor: null, numItems: 10 }
        }),
        sessions: await ctx.runQuery(components.betterAuth.adapter.findMany, {
          model: 'session',
          where: [{ field: 'userId', value: user._id }],
          paginationOpts: { cursor: null, numItems: 10 }
        }),
        profiles: await ctx.db.query('userProfiles').take(2),
        jobs: await ctx.db.system.query('_scheduled_functions').take(1)
      })),
    globalSnapshot: () =>
      t.run(async (ctx) => ({
        app: Object.fromEntries(
          await Promise.all(
            (Object.keys(schema.tables) as TableNames[]).map(async (name) => [
              name,
              await ctx.db.query(name).collect()
            ])
          )
        ),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
        users: await ctx.runQuery(components.betterAuth.adapter.findMany, {
          model: 'user',
          paginationOpts: { cursor: null, numItems: 100 }
        }),
        accounts: await ctx.runQuery(components.betterAuth.adapter.findMany, {
          model: 'account',
          paginationOpts: { cursor: null, numItems: 100 }
        }),
        sessions: await ctx.runQuery(components.betterAuth.adapter.findMany, {
          model: 'session',
          paginationOpts: { cursor: null, numItems: 100 }
        })
      }))
  }
}

describe('private native account deletion credential confirmation', () => {
  it('requires the current account email and password without changing credentials, sessions or app state', async () => {
    const base = await fixture()
    const before = await base.snapshot()
    expect(before.credentials.isDone).toBe(true)
    expect(before.sessions.isDone).toBe(true)
    await expect(
      base.caller.mutation(confirmCredentials, {
        ...base.input,
        email: base.user.email.toUpperCase()
      })
    ).resolves.toBeNull()
    await expect(
      base.caller.mutation(confirmCredentials, {
        ...base.input,
        email: 'someone-else@example.invalid'
      })
    ).rejects.toThrow('Enter the email address for this account.')
    await expect(
      base.caller.mutation(confirmCredentials, {
        ...base.input,
        currentPassword: 'Incorrect-current-password!'
      })
    ).rejects.toThrow('The current password is incorrect.')
    await expect(base.t.mutation(confirmCredentials, base.input)).rejects.toThrow('Unauthenticated')
    for (const input of [
      { ...base.input, ...{ userId: crypto.randomUUID() } },
      { ...base.input, currentPassword: '' },
      { ...base.input, email: 'invalid-email' }
    ])
      await expect(base.caller.mutation(confirmCredentials, input)).rejects.toThrow()
    expect(await base.snapshot()).toEqual(before)
    await expect(base.caller.query(api.account.identity, {})).resolves.toHaveProperty('userId')
  })

  it('rechecks current stored email, password and session expiry instead of trusting old confirmation', async () => {
    const base = await fixture()
    const email = `${crypto.randomUUID()}@example.invalid`
    const password = 'Replacement-current-account-password-2819!'
    await base.t.run(async (ctx) => {
      const hash = await (await createAuth(ctx).$context).password.hash(password)
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: { model: 'user', where: [{ field: '_id', value: base.user._id }], update: { email } }
      })
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'account',
          where: [{ field: '_id', value: base.credential._id }],
          update: { password: hash }
        }
      })
    })
    const before = await base.snapshot()
    await expect(base.caller.mutation(confirmCredentials, base.input)).rejects.toThrow(
      'Enter the email address'
    )
    await expect(
      base.caller.mutation(confirmCredentials, {
        email,
        currentPassword: base.password
      })
    ).rejects.toThrow('The current password is incorrect.')
    await expect(
      base.caller.mutation(confirmCredentials, {
        email,
        currentPassword: password
      })
    ).resolves.toBeNull()
    expect(await base.snapshot()).toEqual(before)
    await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'session',
          where: [{ field: '_id', value: base.session._id }],
          update: { expiresAt: Date.now() }
        }
      })
    )
    const expired = await base.snapshot()
    await expect(
      base.caller.mutation(confirmCredentials, {
        email,
        currentPassword: password
      })
    ).rejects.toThrow('Unauthenticated')
    expect(await base.snapshot()).toEqual(expired)
  })

  it('refuses duplicate or missing password credentials and revoked sessions without writes', async () => {
    const base = await fixture()
    const duplicate = await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'account',
          data: {
            accountId: base.user._id,
            providerId: 'credential',
            userId: base.user._id,
            password: base.hash,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    const duplicated = await base.snapshot()
    await expect(base.caller.mutation(confirmCredentials, base.input)).rejects.toThrow(
      'The current password is incorrect.'
    )
    expect(await base.snapshot()).toEqual(duplicated)
    await base.t.run(async (ctx) => {
      for (const id of [base.credential._id, duplicate._id])
        await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
          input: { model: 'account', where: [{ field: '_id', value: id }] }
        })
    })
    const missing = await base.snapshot()
    await expect(base.caller.mutation(confirmCredentials, base.input)).rejects.toThrow(
      'The current password is incorrect.'
    )
    expect(await base.snapshot()).toEqual(missing)
    await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'session', where: [{ field: '_id', value: base.session._id }] }
      })
    )
    const revoked = await base.snapshot()
    await expect(base.caller.mutation(confirmCredentials, base.input)).rejects.toThrow(
      'Unauthenticated'
    )
    expect(await base.snapshot()).toEqual(revoked)
  })
})

describe('private native account deletion orchestrator', () => {
  it('rejects invalid credentials, stale cookie-session tokens and actor injection without writes', async () => {
    const base = await fixture()
    const expectNoWrite = async (operation: () => Promise<unknown>, expectedError?: string) => {
      const before = await base.globalSnapshot()
      expect(before.users.isDone && before.accounts.isDone && before.sessions.isDone).toBe(true)
      if (expectedError) await expect(operation()).rejects.toThrow(expectedError)
      else await expect(operation()).rejects.toThrow()
      expect(await base.globalSnapshot()).toEqual(before)
    }
    await expectNoWrite(() =>
      base.t.mutation(execute, {
        sessionToken: base.session.token,
        command: { ...base.input, email: 'other-account@example.invalid' }
      })
    )
    await expectNoWrite(() =>
      base.t.mutation(execute, {
        sessionToken: base.session.token,
        command: { ...base.input, currentPassword: 'Incorrect-current-password!' }
      })
    )
    await expectNoWrite(() =>
      base.t.mutation(execute, { sessionToken: crypto.randomUUID(), command: base.input })
    )
    await expectNoWrite(() =>
      base.t.mutation(executeWithActorId, {
        sessionToken: base.session.token,
        command: { ...base.input, actorId: crypto.randomUUID() }
      })
    )
    await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'session',
          where: [{ field: '_id', value: base.session._id }],
          update: { expiresAt: Date.now() - 1 }
        }
      })
    )
    await expectNoWrite(() =>
      base.t.mutation(execute, { sessionToken: base.session.token, command: base.input })
    )
    await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'session', where: [{ field: '_id', value: base.session._id }] }
      })
    )
    await expectNoWrite(() =>
      base.t.mutation(execute, { sessionToken: base.session.token, command: base.input })
    )
  }, 30_000)
})
describe('installed native account deletion cascade', () => {
  it('deletes every own session and linked credential while preserving another account', async () => {
    const base = await fixture()
    const foreign = await base.t.run(async (ctx) => {
      const user = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: 'Unrelated account',
            email: `${crypto.randomUUID()}@example.invalid`,
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        },
        onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
      })
      const account = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'account',
          data: {
            accountId: user._id,
            providerId: 'credential',
            userId: user._id,
            password: base.hash,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
      const session = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'session',
          data: {
            userId: user._id,
            token: crypto.randomUUID(),
            expiresAt: Date.now() + 60_000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'account',
          data: {
            accountId: crypto.randomUUID(),
            providerId: 'linked-provider-proof',
            userId: base.user._id,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
      const extraSession = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'session',
          data: {
            userId: base.user._id,
            token: crypto.randomUUID(),
            expiresAt: Date.now() + 60_000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
      return { user, account, session, extraSession }
    })
    const before = await base.snapshot()
    expect(before.credentials.isDone).toBe(true)
    expect(before.credentials.page).toHaveLength(2)
    expect(before.sessions.isDone).toBe(true)
    expect(before.sessions.page).toHaveLength(2)
    await expect(
      base.t.mutation(execute, { sessionToken: base.session.token, command: base.input })
    ).resolves.toBeNull()
    // The request signs the account out everywhere at once; the staged job removes the rest.
    const scheduled = await base.snapshot()
    expect(scheduled.user).toEqual(before.user)
    expect(scheduled.credentials.page).toEqual([])
    expect(scheduled.sessions.page).toEqual([])
    await drainScheduledWork(base.t)
    const after = await base.snapshot()
    expect(after.user).toBeNull()
    expect(after.credentials.isDone).toBe(true)
    expect(after.credentials.page).toEqual([])
    expect(after.sessions.isDone).toBe(true)
    expect(after.sessions.page).toEqual([])
    expect(after.profiles).toEqual(
      before.profiles.filter((row) => row.authUserId !== base.user._id)
    )
    const retained = await base.t.run(async (ctx) => ({
      user: await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'user',
        where: [{ field: '_id', value: foreign.user._id }]
      }),
      account: await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'account',
        where: [{ field: '_id', value: foreign.account._id }]
      }),
      session: await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'session',
        where: [{ field: '_id', value: foreign.session._id }]
      })
    }))
    expect(retained).toEqual({
      user: foreign.user,
      account: foreign.account,
      session: foreign.session
    })
    await expect(base.caller.query(api.account.identity, {})).rejects.toThrow('Unauthenticated')
    await expect(base.caller.mutation(confirmCredentials, base.input)).rejects.toThrow(
      'Unauthenticated'
    )
    const extraCaller = base.t.withIdentity({
      subject: base.user._id,
      sessionId: foreign.extraSession._id
    })
    await expect(extraCaller.query(api.account.identity, {})).rejects.toThrow('Unauthenticated')
    await expect(extraCaller.mutation(confirmCredentials, base.input)).rejects.toThrow(
      'Unauthenticated'
    )
    const foreignCaller = base.t.withIdentity({
      subject: foreign.user._id,
      sessionId: foreign.session._id
    })
    await expect(foreignCaller.query(api.account.identity, {})).resolves.toHaveProperty('userId')
  }, 30_000)

  it('retries a failed deletion step, which commits nothing, until it succeeds', async () => {
    const base = await fixture()
    const identity = await base.caller.query(api.account.identity, {})
    if (!identity) throw new Error('Missing fixture identity.')
    await base.t.run(async (ctx) => {
      // One row beyond the latest-25 feed bound makes the late native cleanup fail.
      for (let index = 0; index < 26; index++) {
        const occurredAt = new Date(Date.UTC(2026, 8, 4, 0, 0, index)).toISOString()
        const sourcePublicId = crypto.randomUUID()
        await ctx.db.insert('notificationFeedItems', {
          id: crypto.randomUUID(),
          userId: identity.userId,
          workflowKey: 'social-application-decided',
          sourceKind: 'SOCIAL_APPLICATION',
          sourcePublicId,
          groupingKey: null,
          data: {
            kind: 'SOCIAL_APPLICATION_DECIDED',
            sourcePublicId,
            listingPublicId: crypto.randomUUID(),
            listingTitle: 'Game invitation',
            decision: 'ACCEPTED',
            occurredAt
          },
          occurredAt,
          seenAt: null,
          readAt: null
        })
      }
    })
    const feedBefore = await base.t.run((ctx) => ctx.db.query('notificationFeedItems').collect())
    expect(feedBefore).toHaveLength(26)
    const job = () =>
      base.t.run((ctx) =>
        ctx.db
          .query('accountDeletionJobs')
          .withIndex('by_userId', (q) => q.eq('userId', identity.userId))
          .unique()
      )
    vi.useFakeTimers({ now: Date.now() })
    try {
      await expect(
        base.t.mutation(execute, { sessionToken: base.session.token, command: base.input })
      ).resolves.toBeNull()
      await expect(base.caller.query(api.account.identity, {})).rejects.toThrow('Unauthenticated')
      // Run scheduled work one timer at a time until the FINISH step has failed and been retried.
      for (let tick = 0; tick < 200; tick++) {
        const current = await job()
        if (current?.step === 'FINISH' && current.attempt > 0) break
        vi.advanceTimersToNextTimer()
        await base.t.finishInProgressScheduledFunctions()
      }
      const failing = await job()
      expect(failing).toMatchObject({ step: 'FINISH' })
      expect(failing?.attempt).toBeGreaterThan(0)
      // The failed step committed nothing: the feed and the job's position are intact.
      expect(await base.t.run((ctx) => ctx.db.query('notificationFeedItems').collect())).toEqual(
        feedBefore
      )
      // The provider account is removed last, so it survives a failed earlier step.
      expect((await base.snapshot()).user).not.toBeNull()

      await base.t.run(async (ctx) => {
        const oldest = feedBefore.reduce((left, right) =>
          left.occurredAt < right.occurredAt ? left : right
        )
        await ctx.db.delete(oldest._id)
      })
      await drainScheduledWork(base.t)
      expect(await job()).toBeNull()
      expect((await base.snapshot()).user).toBeNull()
      expect(await base.t.run((ctx) => ctx.db.query('notificationFeedItems').collect())).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  }, 30_000)
})

describe('installed native account deletion Campaign ownership restriction', () => {
  it.each(['ACTIVE', 'ARCHIVED'] as const)(
    'preserves every provider/app row when the account owns a %s Campaign',
    async (status) => {
      const { t, first, second } = await publicationFixture(
        import.meta.glob('./**/*.*s'),
        import.meta.glob('./betterAuth/**/*.*s'),
        []
      )
      await first.caller.mutation(api.account.updateProfile, {
        username: 'DeletingOwner',
        bio: null
      })
      await second.caller.mutation(api.account.updateProfile, {
        username: 'UnrelatedOwner',
        bio: null
      })
      const input = {
        name: 'Owned deletion restriction',
        format: 'ONGOING' as const,
        toneTags: ['HEROIC' as const],
        contentMaturity: 'STANDARD' as const,
        gameSystemId: srdSystemRecord.id,
        primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
      }
      let owned = await first.caller.mutation(api.campaigns.create.create, input)
      const unrelated = await second.caller.mutation(api.campaigns.create.create, {
        ...input,
        name: 'Unrelated retained Campaign'
      })
      if (status === 'ARCHIVED')
        owned = await first.caller.mutation(api.campaigns.archive.archive, {
          campaignId: owned.id,
          expectedVersion: owned.version
        })
      expect(owned.status).toBe(status)
      const profile = await t.run((ctx) =>
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', first.userId))
          .unique()
      )
      if (!profile) throw new Error('Missing owned Campaign profile.')
      const tableNames = Object.keys(schema.tables) as TableNames[]
      const snapshot = () =>
        t.run(async (ctx) => ({
          app: Object.fromEntries(
            await Promise.all(
              tableNames.map(async (name) => [name, await ctx.db.query(name).collect()])
            )
          ),
          scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
          users: await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: 'user',
            paginationOpts: { cursor: null, numItems: 100 }
          }),
          accounts: await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: 'account',
            paginationOpts: { cursor: null, numItems: 100 }
          }),
          sessions: await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: 'session',
            paginationOpts: { cursor: null, numItems: 100 }
          })
        }))
      const before = await snapshot()
      expect(before.users.isDone).toBe(true)
      expect(before.accounts.isDone).toBe(true)
      expect(before.sessions.isDone).toBe(true)
      await expect(
        t.run(async (ctx) => {
          await (await createAuth(ctx).$context).internalAdapter.deleteUser(profile.authUserId)
        })
      ).rejects.toThrow('Account deletion is restricted by owned Campaigns.')
      expect(await snapshot()).toEqual(before)
      // The request refuses an owner before it revokes anything or schedules a job.
      await expect(
        t.mutation(internal.accountDeletion.schedule, { authUserId: profile.authUserId })
      ).rejects.toThrow('Account deletion is restricted by owned Campaigns.')
      expect(await snapshot()).toEqual(before)
      await expect(first.caller.query(api.account.identity, {})).resolves.toHaveProperty(
        'userId',
        first.userId
      )
      await expect(
        second.caller.query(api.campaigns.queries.get, { id: unrelated.id })
      ).resolves.toEqual(unrelated)
    },
    30_000
  )
})
describe('installed native account commit gates', () => {
  it('refuses a provider delete without a scheduled job, and with an ACTIVE membership at the account step', async () => {
    const { t, first, second } = await publicationFixture(
      import.meta.glob('./**/*.*s'),
      import.meta.glob('./betterAuth/**/*.*s'),
      []
    )
    const campaign = await second.caller.mutation(api.campaigns.create.create, {
      name: 'Joined after departure',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const profile = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
    )
    if (!profile) throw new Error('Missing deleting account profile.')
    const snapshot = () =>
      t.run(async (ctx) => ({
        profile: await ctx.db.get(profile._id),
        job: await ctx.db
          .query('accountDeletionJobs')
          .withIndex('by_userId', (q) => q.eq('userId', first.userId))
          .unique(),
        user: await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }]
        })
      }))
    const deleteProvider = () =>
      t.run(async (ctx) => {
        await (await createAuth(ctx).$context).internalAdapter.deleteUser(profile.authUserId)
      })

    const unscheduled = await snapshot()
    await expect(deleteProvider()).rejects.toThrow('Account deletion is not scheduled.')
    expect(await snapshot()).toEqual(unscheduled)

    await t.mutation(internal.accountDeletion.schedule, { authUserId: profile.authUserId })
    await advanceAccountDeletion(t, first.userId, 'ACCOUNT')
    await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: first.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    const atAccount = await snapshot()
    expect(atAccount.job).toMatchObject({ step: 'ACCOUNT' })
    expect(atAccount.user).not.toBeNull()
    await expect(
      runAccountDeletionStep(t, first.userId, internal.accountDeletion.deleteAccount)
    ).rejects.toThrow('Account deletion requires Campaign departure first.')
    expect(await snapshot()).toEqual(atAccount)
  })
})
describe('installed native owned authored cleanup', () => {
  it.each(['SUCCESS', 'LATE_ROLLBACK'] as const)(
    'cleans current owned authored records through the native trigger: %s',
    async (outcome) => {
      const { t, first, second } = await publicationFixture(
        import.meta.glob('./**/*.*s'),
        import.meta.glob('./betterAuth/**/*.*s'),
        [[importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte })]]
      )
      const copy = await first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind: 'BACKGROUND',
        subjectId: acolyte.id
      })
      if (!copy.updatedAt) throw new Error('Missing owned draft revision.')
      await first.caller.mutation(api.content.publication.publishDraft, {
        subjectKind: 'BACKGROUND',
        subjectId: copy.subjectId,
        expectedDraftUpdatedAt: copy.updatedAt
      })
      const revised = await first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'BACKGROUND',
        subjectId: copy.subjectId,
        systemId: copy.systemId,
        label: 'Revised account source',
        payload: copy.payload
      })
      if (!revised.updatedAt) throw new Error('Missing revised draft revision.')
      await first.caller.mutation(api.content.publication.publishDraft, {
        subjectKind: 'BACKGROUND',
        subjectId: copy.subjectId,
        expectedDraftUpdatedAt: revised.updatedAt
      })
      await first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'BACKGROUND',
        subjectId: copy.subjectId,
        systemId: copy.systemId,
        label: 'Unpublished working revision',
        payload: copy.payload
      })
      const draftOnly = await first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind: 'BACKGROUND',
        subjectId: acolyte.id
      })
      await second.caller.mutation(api.content.drafts.duplicate, {
        subjectKind: 'BACKGROUND',
        subjectId: acolyte.id
      })
      const tableNames = Object.keys(schema.tables) as TableNames[]
      const snapshot = () =>
        t.run(async (ctx) => ({
          app: Object.fromEntries(
            await Promise.all(
              tableNames.map(async (name) => [name, await ctx.db.query(name).collect()])
            )
          ),
          scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
          users: await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: 'user',
            paginationOpts: { cursor: null, numItems: 100 }
          }),
          accounts: await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: 'account',
            paginationOpts: { cursor: null, numItems: 100 }
          }),
          sessions: await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: 'session',
            paginationOpts: { cursor: null, numItems: 100 }
          })
        }))
      const beforeOwned = await t.run(async (ctx) => ({
        roots: await ctx.db.query('authoredRoots').collect(),
        drafts: await ctx.db.query('authoredDrafts').collect(),
        routes: await ctx.db.query('authoredRouteIds').collect(),
        images: await ctx.db.query('authoredImageSlots').collect(),
        sources: await ctx.db.query('contentSources').collect(),
        versions: await ctx.db.query('authoredVersions').collect()
      }))
      const before = await snapshot()
      const profile = await t.run((ctx) =>
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', first.userId))
          .unique()
      )
      if (!profile) throw new Error('Missing deleting account profile.')
      expect(before.users.isDone && before.accounts.isDone && before.sessions.isDone).toBe(true)
      if (outcome === 'LATE_ROLLBACK') {
        // Drive the real job to its AUTHORED step, then abort that step after its cleanup ran.
        await t.mutation(internal.accountDeletion.schedule, { authUserId: profile.authUserId })
        const steps = [
          internal.campaigns.accountDeparture.step,
          internal.social.accountCleanup.prepareAccountDeletion,
          internal.media.accountRetention.step,
          internal.characters.accountDeletion.step
        ]
        for (const step of steps) await runAccountDeletionStep(t, first.userId, step)
        const atAuthored = await snapshot()
        expect(atAuthored.app.accountDeletionJobs).toEqual([
          expect.objectContaining({ userId: first.userId, step: 'AUTHORED' })
        ])
        const job = atAuthored.app.accountDeletionJobs[0]
        await expect(
          t.run(async (ctx) => {
            await ctx.runMutation(internal.content.deletion.accountDeletionStep, {
              jobId: job._id,
              token: job.token
            })
            throw new Error('Abort after complete native authored cleanup.')
          })
        ).rejects.toThrow('Abort after complete native authored cleanup.')
        expect(await snapshot()).toEqual(atAuthored)
        expect(atAuthored.app.authoredRoots).toEqual(before.app.authoredRoots)
        expect(atAuthored.app.authoredDrafts).toEqual(before.app.authoredDrafts)
      } else {
        await deleteAccountCompletely(t, profile.authUserId)
        const remaining = await t.run(async (ctx) => ({
          roots: await ctx.db.query('authoredRoots').collect(),
          drafts: await ctx.db.query('authoredDrafts').collect(),
          routes: await ctx.db.query('authoredRouteIds').collect(),
          images: await ctx.db.query('authoredImageSlots').collect(),
          sources: await ctx.db.query('contentSources').collect(),
          versions: await ctx.db
            .query('authoredVersions')
            .withIndex('by_id_version', (q) => q.eq('id', copy.subjectId))
            .collect()
        }))
        expect(remaining.roots).toEqual(
          beforeOwned.roots.filter((row) => row.ownerUserId !== first.userId)
        )
        expect(remaining.drafts).toEqual(
          beforeOwned.drafts.filter((row) => row.userId !== first.userId)
        )
        expect(remaining.sources).toEqual(
          beforeOwned.sources.filter((row) => row.ownerUserId !== first.userId)
        )
        const removedIds = new Set([copy.subjectId, draftOnly.subjectId])
        expect(remaining.routes).toEqual(
          beforeOwned.routes.filter((row) => !removedIds.has(row.subjectId))
        )
        expect(remaining.images).toEqual(
          beforeOwned.images.filter((row) => !removedIds.has(row.subjectId))
        )
        expect(remaining.versions).toEqual([])
        await expect(first.caller.query(api.account.identity, {})).rejects.toThrow(
          'Unauthenticated'
        )
        await expect(second.caller.query(api.account.identity, {})).resolves.toHaveProperty(
          'userId',
          second.userId
        )
      }
    },
    30_000
  )
})
