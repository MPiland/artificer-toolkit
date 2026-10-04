import { makeFunctionReference } from 'convex/server'
import { register as registerR2 } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  developmentAccountDeletionRollbackInputSchema,
  type DevelopmentAccountDeletionRollbackInput,
  type DevelopmentAccountDeletionRollbackResult
} from '@artificer-toolkit/schema/api/developmentAccountDeletionRollback'
import { authoredStoredImportReferenceSchema } from '@artificer-toolkit/schema/api/imports'
import { characterDocumentSchema } from '@artificer-toolkit/schema/projections/characterStoredState'
import { reusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { insertActiveCharacterRecord } from '../tests/fixtures/characterRows'
import { publicationFixture, importedSubject } from '../tests/fixtures/publication'
import { api, components, internal } from './_generated/api'
import type { TableNames } from './_generated/dataModel'
import { createAuth } from './authFactory.helper'
import { ensureAuthoredRouteId } from './content/routeIds'
import schema from './schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'
const verifyRollback = makeFunctionReference<
  'action',
  DevelopmentAccountDeletionRollbackInput,
  DevelopmentAccountDeletionRollbackResult
>('developmentAccountDeletionRollback:verifyRollback')
const forceRollback = makeFunctionReference<
  'mutation',
  DevelopmentAccountDeletionRollbackInput,
  null
>('developmentAccountDeletionRollback:forceRollback')
const copyStep = makeFunctionReference<'mutation', { copyId: string }, null>(
  'campaigns/copyJobs:step'
)
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3211')
  vi.stubEnv('LOCAL_R2_ENDPOINT', 'http://127.0.0.1:8026')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})
async function fixture() {
  const base = await publicationFixture(
    import.meta.glob('./**/*.*s'),
    import.meta.glob('./betterAuth/**/*.*s'),
    [[importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte })]]
  )
  registerR2(base.t)
  registerRetrier(base.t, 'r2/actionRetrier')
  const password = 'Local-F12-native-rollback-credentials-8276!'
  const actors = await base.t.run(async (ctx) => {
    const hash = await (await createAuth(ctx).$context).password.hash(password)
    const result = []
    for (const actor of [base.first, base.second]) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', actor.userId))
        .unique()
      if (!profile) throw new Error('Missing rollback actor profile.')
      const email = `draft_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}@example.invalid`
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email }
        }
      })
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'account',
          data: {
            accountId: profile.authUserId,
            providerId: 'credential',
            userId: profile.authUserId,
            password: hash,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
      const session = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'session',
          data: {
            userId: profile.authUserId,
            token: crypto.randomUUID(),
            expiresAt: Date.now() + 600_000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
      result.push({
        userId: actor.userId,
        authUserId: profile.authUserId,
        email,
        sessionToken: session.token
      })
    }
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'account',
        data: {
          accountId: crypto.randomUUID(),
          providerId: 'linked-native-rollback-proof',
          userId: result[0]!.authUserId,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: result[0]!.authUserId,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 600_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
    return result
  })
  const subject = actors[0]!
  const auditor = actors[1]!
  await base.first.caller.mutation(api.account.updateProfile, {
    username: 'RollbackSubject',
    bio: null
  })
  await base.second.caller.mutation(api.account.updateProfile, {
    username: 'RollbackAuditor',
    bio: null
  })
  const copy = await base.first.caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'BACKGROUND',
    subjectId: acolyte.id
  })
  if (!copy.updatedAt) throw new Error('Missing authored draft revision.')
  await base.first.caller.mutation(api.content.publication.publishDraft, {
    subjectKind: 'BACKGROUND',
    subjectId: copy.subjectId,
    expectedDraftUpdatedAt: copy.updatedAt
  })
  await base.first.caller.mutation(api.content.drafts.save, {
    subjectKind: 'BACKGROUND',
    subjectId: copy.subjectId,
    systemId: copy.systemId,
    label: 'Private rollback working draft',
    payload: copy.payload
  })
  await base.second.caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'BACKGROUND',
    subjectId: acolyte.id
  })
  const definition = await base.first.caller.mutation(api.content.definitions.create, {
    gameSystemId: srdSystemRecord.id,
    definitionFamilyKey: 'sense',
    label: 'Private rollback definition',
    description: null
  })
  await base.first.caller.mutation(api.content.definitions.saveDraft, {
    definitionId: definition.id,
    expectedDefinitionVersion: 0,
    expectedDraftVersion: null,
    document: {
      ...reusableDefinitionDocumentDtoSchema.parse(SRD_SENSE_DEFINITIONS[0].document),
      id: definition.id
    }
  })
  await base.t.run((ctx) =>
    ctx.db.insert(
      'authoredImportRefs',
      authoredStoredImportReferenceSchema.parse({
        userId: subject.userId,
        source: 'ARTIFICER_JSON',
        subjectKind: 'BACKGROUND',
        externalId: 'native-rollback-import',
        subjectId: copy.subjectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    )
  )
  const characterId = crypto.randomUUID()
  await base.t.run(async (ctx) => {
    const authored = createEmptyCharacterAuthored({
      id: characterId,
      systemId: srdSystemRecord.id,
      userId: subject.userId
    })
    await insertActiveCharacterRecord(
      ctx,
      {
        ...characterDocumentSchema.parse(JSON.parse(JSON.stringify(authored))),
        status: 'DRAFT'
      },
      { createdAt: new Date().toISOString(), streamVersion: 0 }
    )
    await ensureAuthoredRouteId(ctx, 'CHARACTER', characterId, false, subject.userId)
  })
  await base.first.caller.mutation(api.characters.drafts.create, {
    id: characterId,
    systemId: srdSystemRecord.id
  })
  await base.first.caller.mutation(api.characters.drafts.create, {
    id: crypto.randomUUID(),
    systemId: srdSystemRecord.id
  })
  await base.first.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: srdSystemRecord.id,
    name: 'Private rollback blueprint',
    enemies: [{ kind: 'CUSTOM', label: 'Rollback enemy', maxHitPoints: 10 }],
    commandId: crypto.randomUUID()
  })
  const settings = {
    name: 'Transferred rollback source',
    format: 'ONGOING' as const,
    toneTags: ['HEROIC' as const],
    contentMaturity: 'STANDARD' as const,
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  }
  const source = await base.first.caller.mutation(api.campaigns.create.create, settings)
  expect(source.role).toBe('OWNER')
  const sourceNote = await base.first.caller.mutation(api.campaigns.notebooks.create, {
    campaignId: source.id,
    title: 'Selected rollback note',
    content: '<p>Preserved transfer content</p>',
    visibility: 'SHARED',
    category: 'GENERAL'
  })
  const copyProgress = await base.first.caller.mutation(api.campaigns.copyJobs.begin, {
    campaignId: source.id,
    expectedVersion: source.version,
    commandId: crypto.randomUUID(),
    notebookCategories: ['GENERAL']
  })
  expect(copyProgress.status).toBe('RUNNING')
  expect(copyProgress.destination).toBeNull()
  // Fake timers hold native runners; one real native step stages the selected note without publication.
  await base.t.mutation(copyStep, { copyId: copyProgress.copyId })
  const stagedProgress = await base.first.caller.query(api.campaigns.copyJobs.progress, {
    copyId: copyProgress.copyId
  })
  expect(stagedProgress.status).toBe('RUNNING')
  expect(stagedProgress.destination).toBeNull()
  expect(stagedProgress.copiedSections).toBe(1)
  // Match ownership.test.ts's active recipient membership prerequisite. Transfer itself uses both public producers.
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: source.id,
      userId: auditor.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: source.createdAt,
      joinedAt: source.createdAt,
      leftAt: null
    })
  )
  await base.first.caller.mutation(api.campaigns.ownership.request, {
    campaignId: source.id,
    recipientUserId: auditor.userId
  })
  const transferred = await base.second.caller.mutation(api.campaigns.ownership.accept, {
    campaignId: source.id
  })
  expect(transferred.role).toBe('OWNER')
  const copyMetadata = await base.t.run(async (ctx) => {
    const owned = await ctx.db
      .query('campaigns')
      .withIndex('by_ownerUserId_status', (q) => q.eq('ownerUserId', subject.userId))
      .take(1)
    expect(owned.length).toBe(0)
    const row = await ctx.db
      .query('campaignCopyJobs')
      .withIndex('by_publicId', (q) => q.eq('id', copyProgress.copyId))
      .unique()
    if (!row) throw new Error('Missing producer-created copy metadata.')
    return row
  })
  const sourceNotes = await base.t.run((ctx) =>
    ctx.db
      .query('campaignNotebookSections')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', source.id))
      .take(2)
  )
  const stagedNotes = await base.t.run((ctx) =>
    ctx.db
      .query('campaignNotebookSections')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', copyMetadata.destinationCampaignId))
      .take(2)
  )
  const mediaAssetIds: string[] = []
  // Public upload producers sign locally; no upload or provider request is performed.
  for (const caller of [base.first.caller, base.second.caller]) {
    const upload = await caller.mutation(api.media.assets.createAvatarUpload, {
      originalFileName: 'rollback.png',
      declaredMimeType: 'image/png',
      declaredBytes: 10,
      idempotencyKey: crypto.randomUUID()
    })
    mediaAssetIds.push(upload.assetId)
  }
  const input = developmentAccountDeletionRollbackInputSchema.parse({
    fixture: {
      auditorUserId: auditor.userId,
      subjectUserId: subject.userId,
      authUserId: subject.authUserId,
      email: subject.email
    },
    sessionToken: subject.sessionToken,
    command: { email: subject.email, currentPassword: password }
  })
  const snapshot = () =>
    base.t.run(async (ctx) => {
      const app = await Promise.all(
        (Object.keys(schema.tables) as TableNames[]).map(async (name) => {
          const rows = await ctx.db.query(name).take(201)
          if (rows.length > 200)
            throw new Error('Isolated rollback test fixture exceeded its complete-table bound.')
          return [name, rows] as const
        })
      )
      const scheduled = await ctx.db.system.query('_scheduled_functions').take(257)
      if (scheduled.length > 256)
        throw new Error('Isolated rollback test scheduler exceeded its complete bound.')
      const provider = await Promise.all(
        (['user', 'account', 'session'] as const).map(async (model) => {
          const rows = await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model,
            paginationOpts: { cursor: null, numItems: 201 }
          })
          if (!rows.isDone)
            throw new Error('Isolated rollback test provider catalogue is incomplete.')
          return [model, rows] as const
        })
      )
      return { app: Object.fromEntries(app), scheduled, provider: Object.fromEntries(provider) }
    })
  return {
    ...base,
    input,
    subject,
    auditor,
    source,
    sourceNote,
    transferred,
    copyProgress,
    stagedProgress,
    copyMetadata,
    sourceNotes,
    stagedNotes,
    mediaAssetIds,
    snapshot
  }
}

describe('development native SDK account deletion rollback proof', () => {
  it('reaches the late marker after installed SDK cleanup and restores complete application, provider and scheduled rows', async () => {
    const base = await fixture()
    const before = await base.snapshot()
    // Nonvacuous fixture spans all four scopes, linked credentials/sessions, and native persisted jobs.
    expect(before.app.characters.length).toBeGreaterThan(0)
    expect(before.app.characterDrafts.length).toBeGreaterThan(0)
    expect(before.app.authoredRoots.length).toBeGreaterThan(1)
    expect(before.app.authoredImportRefs.length).toBeGreaterThan(0)
    expect(before.app.reusableDefinitions.length).toBeGreaterThan(0)
    expect(before.app.reusableDefinitionDrafts.length).toBeGreaterThan(0)
    expect(before.app.encounterBlueprints.length).toBeGreaterThan(0)
    expect(before.app.mediaAssets.length).toBe(2)
    expect(before.app.campaignCopyJobs.length).toBe(1)
    expect(before.scheduled.length).toBeGreaterThanOrEqual(3)
    expect(base.copyMetadata.id === base.copyProgress.copyId).toBe(true)
    expect(base.copyMetadata.ownerUserId === base.subject.userId).toBe(true)
    expect(base.copyMetadata.status === 'RUNNING').toBe(true)
    expect(base.copyMetadata.copiedSections === 1).toBe(true)
    expect(
      base.transferred.memberships.find((member) => member.role === 'OWNER')?.userId ===
        base.auditor.userId
    ).toBe(true)
    expect(base.mediaAssetIds.length).toBe(2)
    const providerCounts = await base.t.run(async (ctx) => {
      const sessions = await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: 'session',
        where: [{ field: 'userId', value: base.subject.authUserId }],
        paginationOpts: { cursor: null, numItems: 101 }
      })
      const accounts = await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: 'account',
        where: [{ field: 'userId', value: base.subject.authUserId }],
        paginationOpts: { cursor: null, numItems: 101 }
      })
      if (!sessions.isDone || !accounts.isDone)
        throw new Error('Subject provider catalogue is incomplete.')
      return { sessions: sessions.page.length, accounts: accounts.page.length }
    })
    // publicationFixture's original session plus two adapter-created subject sessions.
    expect(providerCounts.sessions).toBe(3)
    expect(providerCounts.accounts).toBe(2)
    const sourceRows = base.sourceNotes
    const copyRow = base.copyMetadata
    expect(sourceRows.length).toBe(1)
    expect(base.stagedNotes.length).toBe(1)
    expect(base.stagedNotes[0]?.authorUserId === base.subject.userId).toBe(true)
    await expect(
      base.t.run(async (ctx) => {
        await ctx.runMutation(internal.accountDeletion.execute, {
          sessionToken: base.input.sessionToken,
          command: base.input.command
        })
        const retainedSource = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', base.source.id))
          .unique()
        expect(retainedSource?.ownerUserId === base.auditor.userId).toBe(true)
        expect(retainedSource?.name === base.source.name).toBe(true)
        const retainedNotes = await ctx.db
          .query('campaignNotebookSections')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.source.id))
          .take(2)
        expect(JSON.stringify(retainedNotes) === JSON.stringify(sourceRows)).toBe(true)
        const retainedCopy = await ctx.db
          .query('campaignCopyJobs')
          .withIndex('by_publicId', (q) => q.eq('id', base.copyProgress.copyId))
          .unique()
        // Native lifecycle schedules copy cleanup; staged metadata persists until that runner executes.
        expect(JSON.stringify(retainedCopy) === JSON.stringify(copyRow)).toBe(true)
        throw new Error('Abort after native subject cleanup preserves transferred source.')
      })
    ).rejects.toThrow('Abort after native subject cleanup preserves transferred source.')
    expect(JSON.stringify(await base.snapshot()) === JSON.stringify(before)).toBe(true)
    await expect(base.t.mutation(forceRollback, base.input)).rejects.toThrow(
      'Injected native account deletion fixture rollback'
    )
    // Compare privately as booleans so failed Vitest assertions cannot print credentials or tokens.
    expect(JSON.stringify(await base.snapshot()) === JSON.stringify(before)).toBe(true)
    await expect(base.t.action(verifyRollback, base.input)).resolves.toEqual({ rolledBack: true })
    expect(JSON.stringify(await base.snapshot()) === JSON.stringify(before)).toBe(true)
    await expect(base.first.caller.query(api.account.identity, {})).resolves.toHaveProperty(
      'userId',
      base.subject.userId
    )
    await expect(base.second.caller.query(api.account.identity, {})).resolves.toHaveProperty(
      'userId',
      base.auditor.userId
    )
  }, 60_000)
  it('rejects wrong subject sessions, mismatched mappings and wrong credentials without writes or false rollback success', async () => {
    const base = await fixture()
    const before = await base.snapshot()
    await expect(
      base.t.action(verifyRollback, { ...base.input, sessionToken: base.auditor.sessionToken })
    ).rejects.toThrow('Account rollback session does not belong to the exact fixture subject.')
    expect(JSON.stringify(await base.snapshot()) === JSON.stringify(before)).toBe(true)
    for (const input of [
      { ...base.input, fixture: { ...base.input.fixture, authUserId: base.auditor.authUserId } },
      { ...base.input, fixture: { ...base.input.fixture, auditorUserId: base.subject.userId } },
      {
        ...base.input,
        command: { ...base.input.command, currentPassword: 'Incorrect-native-rollback-password!' }
      }
    ]) {
      await expect(base.t.action(verifyRollback, input)).rejects.toThrow()
      expect(JSON.stringify(await base.snapshot()) === JSON.stringify(before)).toBe(true)
    }
  }, 60_000)
})
