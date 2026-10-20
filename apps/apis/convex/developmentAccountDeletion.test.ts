import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { convexTest } from '../tests/convexTest'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { describe, expect, it } from 'vitest'
import type {
  DevelopmentAccountDeletionInspectInput,
  DevelopmentAccountDeletionInspectResult
} from '@artificer-toolkit/schema/api/developmentAccountDeletion'
import {
  developmentAccountDeletionInspectInputSchema,
  developmentAccountDeletionInspectResultSchema
} from '@artificer-toolkit/schema/api/developmentAccountDeletion'
import { api, components, internal } from './_generated/api'
import authSchema from './betterAuth/schema'
import schema from './schema'
import { fixture as socialFixture } from '../tests/fixtures/socialWriters'
import { importedSubject, importSeededSubjects } from '../tests/fixtures/publication'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

const inspect = makeFunctionReference<
  'query',
  DevelopmentAccountDeletionInspectInput,
  DevelopmentAccountDeletionInspectResult
>('developmentAccountDeletion:inspect')

async function fixture() {
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  registerRateLimiter(t)
  const createAccount = async (name: string) => {
    const user = await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name,
            email: `draft_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}@example.invalid`,
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        },
        onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
      })
    )
    const profile = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_authUserId', (q) => q.eq('authUserId', user._id))
        .unique()
    )
    if (!profile) throw new Error('Missing F12 fixture profile.')
    return { user, profile }
  }
  const subject = await createAccount('F12 subject')
  const auditor = await createAccount('F12 auditor')
  const input = (
    scope: DevelopmentAccountDeletionInspectInput['scope'],
    known?: DevelopmentAccountDeletionInspectInput['known']
  ) => ({
    auditorUserId: auditor.profile.userId,
    subjectUserId: subject.profile.userId,
    authUserId: subject.user._id,
    email: subject.user.email,
    scope,
    ...(known ? { known } : {})
  })
  return { t, subject, auditor, input }
}

async function makeDraftFixtureAccount(
  base: Awaited<ReturnType<typeof socialFixture>>,
  subjectUserId: string,
  auditorUserId: string
) {
  const [subject, auditor] = await base.t.run(async (ctx) =>
    Promise.all([
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', subjectUserId))
        .unique(),
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', auditorUserId))
        .unique()
    ])
  )
  if (!subject || !auditor) throw new Error('Missing social fixture profile.')
  const subjectEmail = `draft_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}@example.invalid`
  const auditorEmail = `draft_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}@example.invalid`
  await base.t.run(async (ctx) => {
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        where: [{ field: '_id', value: subject.authUserId }],
        update: { email: subjectEmail }
      }
    })
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        where: [{ field: '_id', value: auditor.authUserId }],
        update: { email: auditorEmail }
      }
    })
  })
  return {
    subject,
    input: (
      scope: DevelopmentAccountDeletionInspectInput['scope'],
      known?: DevelopmentAccountDeletionInspectInput['known']
    ) => ({
      auditorUserId,
      subjectUserId,
      authUserId: subject.authUserId,
      email: subjectEmail,
      scope,
      ...(known ? { known } : {})
    })
  }
}
function decoded(result: DevelopmentAccountDeletionInspectResult) {
  return JSON.parse(result.stateJson) as Record<string, Array<Record<string, unknown>>>
}

describe('development account-deletion inspector', () => {
  it('allows only the local fixture account and maps its provider user to the public profile UUID', async () => {
    const base = await fixture()
    const result = await base.t.query(inspect, base.input('IDENTITY'))
    const state = decoded(result)
    expect(state.userProfiles).toMatchObject([
      { userId: base.subject.profile.userId, authUserId: base.subject.user._id }
    ])
    expect(state.providerUsers).toMatchObject([
      { _id: base.subject.user._id, email: base.subject.user.email }
    ])
    await expect(
      base.t.query(inspect, {
        ...base.input('IDENTITY'),
        email: 'draft_000000000000@example.invalid'
      })
    ).rejects.toThrow('identity mismatch')
    await expect(
      base.t.query(inspect, { ...base.input('IDENTITY'), auditorUserId: crypto.randomUUID() })
    ).rejects.toThrow('Fixture profile')
    process.env.SITE_URL = 'https://app.example.invalid'
    try {
      await expect(base.t.query(inspect, base.input('IDENTITY'))).rejects.toThrow(
        'development application origin'
      )
    } finally {
      process.env.SITE_URL = 'http://localhost:3000'
    }
  }, 30_000)

  it('enforces strict shared input and output scopes', async () => {
    const base = await fixture()
    expect(
      developmentAccountDeletionInspectInputSchema.safeParse({
        ...base.input('IDENTITY'),
        extra: true
      }).success
    ).toBe(false)
    expect(
      developmentAccountDeletionInspectInputSchema.safeParse({
        ...base.input('IDENTITY'),
        scope: 'OTHER'
      }).success
    ).toBe(false)
    expect(
      developmentAccountDeletionInspectResultSchema.safeParse({
        stateJson: '{}',
        known: {},
        extra: true
      }).success
    ).toBe(false)
    for (const scope of ['IDENTITY', 'CHARACTERS', 'AUTHORED', 'DEFERRED'] as const)
      await expect(base.t.query(inspect, base.input(scope))).resolves.toMatchObject({
        known: expect.any(Object),
        stateJson: expect.any(String)
      })
  })

  it('fails rather than truncating a provider catalogue and retains the exact complete catalogue below the bound', async () => {
    const base = await fixture()
    await base.t.run(async (ctx) => {
      for (let index = 0; index < 100; index++)
        await ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: 'account',
            data: {
              accountId: `${index}`,
              providerId: `fixture-${index}`,
              userId: base.subject.user._id,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }
          }
        })
    })
    expect(
      decoded(await base.t.query(inspect, base.input('IDENTITY'))).providerAccounts
    ).toHaveLength(100)
    await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'account',
          data: {
            accountId: 'overflow',
            providerId: 'fixture-overflow',
            userId: base.subject.user._id,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    await expect(base.t.query(inspect, base.input('IDENTITY'))).rejects.toThrow(
      'Provider catalogue exceeds'
    )
  })

  it('requires captured known evidence after subject deletion while its distinct fixture auditor remains alive', async () => {
    const base = await fixture()
    const known = (await base.t.query(inspect, base.input('IDENTITY'))).known
    await base.t.run(async (ctx) => {
      await ctx.db.delete(base.subject.profile._id)
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'user', where: [{ field: '_id', value: base.subject.user._id }] }
      })
    })
    await expect(base.t.query(inspect, base.input('CHARACTERS'))).rejects.toThrow(
      'previously captured known identities'
    )
    const deletedState = decoded(await base.t.query(inspect, base.input('IDENTITY', known)))
    expect(deletedState.userProfiles).toEqual([])
    expect(deletedState.providerUsers).toEqual([])

    const alive = await fixture()
    await expect(
      alive.t.query(
        inspect,
        alive.input('CHARACTERS', {
          characterIds: [crypto.randomUUID()],
          sourceIds: [],
          campaignIds: [],
          rootReferences: [],
          dependentRootReferences: [],
          definitionIds: [],
          blueprintIds: [],
          copyDestinationIds: [],
          mediaAssetIds: [],
          socialProfileId: null
        })
      )
    ).rejects.toThrow('Known Character is not owned')
  })

  it('retains known child discovery after every owned root witness disappears and keeps the foreign child out of owned roots', async () => {
    const base = await socialFixture()
    const auditor = await base.addActor('F12Auditor')
    const account = await makeDraftFixtureAccount(base, base.owner.userId, auditor.userId)
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'CLASS', ...fighter, document: fighter })]
    })
    const template = await base.t.run((ctx) =>
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fighter.id))
        .unique()
    )
    if (!template || template.subjectKind !== 'CLASS')
      throw new Error('Missing imported CLASS template.')
    const copied = await base.owner.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'CLASS',
      subjectId: template.id
    })
    const foreignUserId = crypto.randomUUID()
    const { _id, _creationTime, ...templateFields } = template
    await base.t.run(async (ctx) => {
      const copiedDraft = await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', copied.subjectId))
        .unique()
      if (!copiedDraft) throw new Error('Missing owned CLASS draft.')
      await ctx.db.insert('authoredRoots', {
        ...templateFields,
        id: crypto.randomUUID(),
        ownerUserId: foreignUserId,
        parentClassId: copied.subjectId
      })
    })
    const beforeDeletion = await base.t.query(inspect, account.input('AUTHORED'))
    expect(beforeDeletion.known.rootReferences).toContainEqual(
      expect.objectContaining({ id: copied.subjectId, subjectKind: 'CLASS' })
    )
    await base.t.run(async (ctx) => {
      const draft = await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', copied.subjectId))
        .unique()
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', copied.subjectId))
        .unique()
      if (!draft) throw new Error('Missing owned draft before deletion.')
      await ctx.db.delete(draft._id)
      if (root) await ctx.db.delete(root._id)
      await ctx.db.delete(account.subject._id)
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'user', where: [{ field: '_id', value: account.subject.authUserId }] }
      })
    })
    const afterDeletion = await base.t.query(
      inspect,
      account.input('AUTHORED', beforeDeletion.known)
    )
    const state = decoded(afterDeletion)
    expect(state.authoredRoots).toEqual([])
    expect(state.authoredDependentRoots).toMatchObject([
      { parentClassId: copied.subjectId, ownerUserId: foreignUserId }
    ])
    expect(afterDeletion.known.rootReferences.map((reference) => reference.id)).toContain(
      copied.subjectId
    )
    expect(afterDeletion.known.dependentRootReferences.map((reference) => reference.id)).toContain(
      state.authoredDependentRoots?.[0]?.id
    )
  })
  it('finds cross-owner host application delivery intents through the applicant source/workflow index', async () => {
    const base = await socialFixture()
    const account = await makeDraftFixtureAccount(base, base.other.userId, base.owner.userId)
    const application = await base.other.caller.mutation(api.social.applications.submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Inspect the host notification dependency.'
    })
    const state = decoded(await base.t.query(inspect, account.input('DEFERRED')))
    expect(state.socialApplications).toMatchObject([{ id: application.applicationPublicId }])
    expect(state.notificationDeliveryIntents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientUserId: base.owner.userId,
          sourcePublicId: application.applicationPublicId,
          workflowKey: 'social-application-submitted'
        })
      ])
    )
  })
})
