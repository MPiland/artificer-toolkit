// @vitest-environment node
import { register } from '@convex-dev/r2/test'
import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignContentRemovalReceiptDto,
  UnshareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  contentSnapshotObjectKey,
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema,
  contentSnapshotListObjectSchema,
  type ContentSnapshotKind,
  type ContentSnapshotPart
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { clubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/club-plus-1.js'
import { dwarf } from '@artificer-toolkit/source-data/srd/races/dwarf.js'
import { elf, highElf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import {
  compileAsPublished,
  importedSubject,
  importSeededSubjects,
  syncImportedDerived
} from '../../tests/fixtures/publication'
import { startLocalR2 } from '../../tests/localR2'
import { api, internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import { catalogueMetadata } from '../content/catalogueMetadata'
import { insertAuthoredVersion } from '../content/documents'
import { parsePublicationDocument } from '../content/publicationDocument'
import { requireDefaultUserContentSource } from '../content/sources'
import { withSceneVisionTracking } from '../lib/mutations'
import { CONTENT_SNAPSHOT_BUILD_DELAY_MS, type ContentSnapshotScopeRef } from './marking'

const unshare = makeFunctionReference<
  'mutation',
  UnshareCampaignContentInput,
  CampaignContentRemovalReceiptDto
>('campaigns/contentShares:unshare')

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

type HomebrewDocument = { id: string; systemId: string; label: string }

async function setup() {
  const server = await startLocalR2()
  vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('LOCAL_R2_ENDPOINT', server.endpoint)
  const base = await fixture()
  const { t, owner } = base
  register(t)
  const userSourceId = await t.run((ctx) =>
    requireDefaultUserContentSource(ctx, srdSystemRecord.id, owner.userId)
  )
  // Load the build's modules on real timers; a cold import can outlast the fake-timer pump limit.
  await t.action(internal.contentSnapshots.actions.build, {
    scope: 'SOURCE',
    scopeId: userSourceId
  })
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

  /** Publishes a Homebrew version through the trigger-wrapped writer, as publication does. */
  async function publish(
    kind: 'RACE' | 'FEAT' | 'EQUIPMENT',
    document: HomebrewDocument,
    { parentId = null, importJobId }: { parentId?: string | null; importJobId?: string } = {}
  ) {
    const parentField = kind === 'RACE' ? 'parentRaceId' : 'parentEquipmentId'
    await t.run(async (raw) => {
      const ctx = withSceneVisionTracking(raw)
      const current = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', document.id))
        .unique()
      const authored = {
        ...document,
        ...(parentId === null ? {} : { [parentField]: parentId }),
        userId: owner.userId,
        status: 'ACTIVE'
      }
      const checksum = checksumRuleDocument(authored)
      const versionId = crypto.randomUUID()
      const currentVersionId = await insertAuthoredVersion(
        ctx,
        {
          subjectKind: kind,
          id: document.id,
          systemId: document.systemId,
          label: document.label,
          checksum,
          contentSourceId: userSourceId,
          importJobId,
          versionId,
          version: current ? 2 : 1,
          documentSchemaVersion: 1
        },
        canonicalizeRuleDocument(authored),
        await compileAsPublished(ctx, parsePublicationDocument(kind, authored), owner.userId)
      )
      const fields = {
        label: document.label,
        checksum,
        catalogue: await catalogueMetadata(
          ctx,
          { subjectKind: kind, document: authored },
          {
            checksum,
            publicId: document.id,
            createdAt: Date.now()
          }
        ),
        currentVersionId,
        currentVersionPublicId: versionId
      }
      if (current) {
        await ctx.db.patch(current._id, fields)
        return
      }
      await ctx.db.insert('authoredRoots', {
        ...fields,
        id: document.id,
        subjectKind: kind,
        systemId: document.systemId,
        contentSourceId: userSourceId,
        importJobId,
        ownerUserId: owner.userId,
        ...(kind === 'RACE' ? { parentRaceId: parentId } : {}),
        ...(kind === 'EQUIPMENT' ? { parentEquipmentId: parentId } : {})
      })
    })
    return document.id
  }

  const head = (ref: ContentSnapshotScopeRef) =>
    t.run((ctx) =>
      ctx.db
        .query('contentSnapshotHeads')
        .withIndex('by_scope_scopeId', (q) => q.eq('scope', ref.scope).eq('scopeId', ref.scopeId))
        .unique()
    )
  async function readObject(
    ref: ContentSnapshotScopeRef,
    snapshot: Doc<'contentSnapshotHeads'> | null,
    kind: ContentSnapshotKind,
    part: ContentSnapshotPart = 'index'
  ) {
    const object = snapshot?.kinds[kind]?.[part]
    if (!object) return null
    const stored = server.contentSnapshotObjects.get(
      contentSnapshotObjectKey({ format: 3, ...ref, kind, part }, object.sha256)
    )
    if (!stored) throw new Error('Committed snapshot object is missing from R2.')
    const json = await new Response(
      new Blob([new Uint8Array(stored.body)]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).text()
    const schema =
      part === 'documents'
        ? contentSnapshotDocumentsObjectSchema
        : part === 'list'
          ? contentSnapshotListObjectSchema
          : contentSnapshotIndexObjectSchema
    return schema.parse(JSON.parse(json))
  }
  async function readPart(
    ref: ContentSnapshotScopeRef,
    snapshot: Doc<'contentSnapshotHeads'> | null,
    kind: ContentSnapshotKind,
    part: ContentSnapshotPart = 'index'
  ) {
    return (await readObject(ref, snapshot, kind, part))?.roots ?? []
  }

  return {
    ...base,
    server,
    userSource: { scope: 'SOURCE', scopeId: userSourceId } as const,
    srdSource: { scope: 'SOURCE', scopeId: SRD_CONTENT_SOURCE.id } as const,
    publish,
    settle: () => t.finishAllScheduledFunctions(vi.runAllTimers),
    head,
    objects: () => t.run((ctx) => ctx.db.query('contentSnapshotObjects').collect()),
    puts: () => server.methods.filter((method) => method === 'PUT').length,
    readPart,
    readObject,
    rootIds: async (
      ref: ContentSnapshotScopeRef,
      snapshot: Doc<'contentSnapshotHeads'> | null,
      kind: ContentSnapshotKind
    ) => (await readPart(ref, snapshot, kind)).map((root) => root.id)
  }
}

function homebrew(document: HomebrewDocument) {
  return { ...document, id: crypto.randomUUID() }
}

describe('content snapshot builds', () => {
  it('rebuilds only the published scope and kind, and a retried build changes nothing', async () => {
    const {
      t,
      server,
      userSource,
      srdSource,
      publish,
      settle,
      head,
      puts,
      rootIds,
      readPart,
      readObject
    } = await setup()
    try {
      // A base Race compiles at import, so one import is one snapshot revision.
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [importedSubject({ subjectKind: 'RACE', ...dwarf, document: dwarf })]
      })
      const race = homebrew(elf)
      await publish('RACE', race)
      await publish('FEAT', homebrew(grappler))
      const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
      expect(scheduled.map((job) => job.args[0])).toEqual([srdSource, userSource])
      await settle()

      const before = { user: await head(userSource), srd: await head(srdSource) }
      expect(before.srd).toMatchObject({ revision: 1, builtRevision: 1 })
      expect(await rootIds(srdSource, before.srd, 'RACE')).toEqual([dwarf.id])
      expect(before.user).toMatchObject({ revision: 2, builtRevision: 2 })
      expect(Object.keys(before.user!.kinds).sort()).toEqual(['FEAT', 'RACE'])
      expect(before.user!.buildScheduledAt).toBeUndefined()
      const documents = await readObject(userSource, before.user, 'RACE', 'documents')
      if (documents?.part !== 'documents') throw new Error('Missing documents snapshot.')
      const published = await t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', race.id))
          .unique()
        if (!root) throw new Error('Missing published Race.')
        const version = await ctx.db.get(root.currentVersionId)
        if (!version) throw new Error('Missing published Race version.')
        return { root, version }
      })
      expect(documents.versions).toEqual([
        {
          identity: {
            subjectKind: 'RACE',
            subjectId: race.id,
            systemId: race.systemId,
            contentSourceId: userSource.scopeId,
            versionId: published.root.currentVersionPublicId,
            checksum: published.root.checksum
          },
          version: published.version.version,
          storedParentId: published.root.parentRaceId
        }
      ])
      expect(await readPart(userSource, before.user, 'RACE', 'list')).toEqual([
        expect.objectContaining({
          id: race.id,
          publicId: race.id,
          label: elf.label,
          category: elf.category
        })
      ])
      expect(puts()).toBe(9)
      // Only PLATFORM source objects carry the public marker the Worker serves publicly.
      const access = [...server.contentSnapshotObjects].map(([key, object]) => [
        key.split('/')[2],
        object.metadata
      ])
      expect(access).toHaveLength(9)
      for (const [scopeId, metadata] of access)
        expect(metadata).toEqual(scopeId === SRD_CONTENT_SOURCE.id ? { access: 'public' } : {})

      await publish('RACE', { ...race, label: 'Wood-touched Elf' })
      await settle()
      const after = { user: await head(userSource), srd: await head(srdSource) }
      expect(after.srd).toEqual(before.srd)
      expect(after.user).toMatchObject({ revision: 3, builtRevision: 3 })
      expect(after.user!.kinds.FEAT).toEqual(before.user!.kinds.FEAT)
      expect(after.user!.kinds.RACE!.index.sha256).not.toBe(before.user!.kinds.RACE!.index.sha256)
      expect(puts()).toBe(12)
      expect(server.contentSnapshotObjects.size).toBe(12)

      // A duplicate or retried build of a built revision reads nothing new and uploads nothing.
      await t.action(internal.contentSnapshots.actions.build, userSource)
      expect(await head(userSource)).toEqual(after.user)
      expect(puts()).toBe(12)
    } finally {
      await server.close()
    }
  }, 30_000)

  it('reads a scope kind across several pages without dropping or repeating roots', async () => {
    const { t, server, owner, userSource, publish, settle, head, rootIds } = await setup()
    try {
      const campaign = await owner.caller.mutation(api.campaigns.create.create, {
        name: 'Snapshot pages',
        format: 'ONGOING',
        toneTags: ['HEROIC'],
        contentMaturity: 'STANDARD',
        gameSystemId: srdSystemRecord.id,
        primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
      })
      const campaignScope = { scope: 'CAMPAIGN', scopeId: campaign.id } as const
      const visible: string[] = []
      for (let index = 0; index < 5; index++) {
        const id = await publish('RACE', homebrew(elf))
        visible.push(id)
        await owner.caller.mutation(api.campaigns.contentShares.share, {
          campaignId: campaign.id,
          subjectKind: 'RACE',
          subjectId: id
        })
        // Hidden import rows between visible ones leave short pages, never missing roots.
        await publish('RACE', homebrew(dwarf), { importJobId: crypto.randomUUID() })
      }
      await settle()
      for (const ref of [userSource, campaignScope]) {
        const paged: string[] = []
        let pages = 0
        let cursor: string | null = null
        for (let isDone = false; !isDone; pages++) {
          const page:
            | { sources: string[]; continueCursor: string; isDone: boolean }
            | { pendingCompilation: true } = await t.query(
            internal.contentSnapshots.heads.readScopeKind,
            {
              ...ref,
              kind: 'RACE',
              paginationOpts: { numItems: 2, cursor }
            }
          )
          if ('pendingCompilation' in page) throw new Error('A root compilation is pending.')
          for (const json of page.sources)
            paged.push((JSON.parse(json) as { document: { id: string } }).document.id)
          cursor = page.continueCursor
          isDone = page.isDone
        }
        expect(pages).toBeGreaterThanOrEqual(3)
        expect(paged.sort()).toEqual([...visible].sort())
        expect(await rootIds(ref, await head(ref), 'RACE')).toEqual(paged)
      }
    } finally {
      await server.close()
    }
  }, 30_000)

  it('rejects a stale compare-and-set and records its uploads as superseded', async () => {
    const { t, server, userSource, publish, settle, head, objects } = await setup()
    try {
      await publish('RACE', homebrew(elf))
      await settle()
      const built = await head(userSource)
      const orphan = contentSnapshotObjectKey(
        { format: 3, ...userSource, kind: 'FEAT', part: 'index' },
        'a'.repeat(64)
      )
      const stale = await t.mutation(internal.contentSnapshots.heads.commitBuild, {
        ...userSource,
        revisionBuiltFrom: built!.builtRevision,
        kinds: {},
        uploadedKeys: [orphan],
        scopeExists: true
      })
      expect(stale).toBe('STALE')
      expect(await head(userSource)).toEqual(built)
      expect((await objects()).find((row) => row.key === orphan)?.supersededAt).toEqual(
        expect.any(Number)
      )
    } finally {
      await server.close()
    }
  }, 30_000)

  it('projects Equipment without a stored builder projection instead of dropping it', async () => {
    const { server, userSource, publish, settle, head, readPart } = await setup()
    try {
      const parent = await publish('EQUIPMENT', homebrew(club))
      const variant = await publish('EQUIPMENT', homebrew(clubPlus1), { parentId: parent })
      await settle()
      const roots = await readPart(userSource, await head(userSource), 'EQUIPMENT')
      expect(roots).toHaveLength(2)
      expect(roots.find((root) => root.id === variant)).toMatchObject({
        parentEquipmentId: parent,
        category: club.category
      })
    } finally {
      await server.close()
    }
  }, 30_000)

  it('excludes a hidden import row', async () => {
    const { server, userSource, publish, settle, head, rootIds } = await setup()
    try {
      const visible = await publish('RACE', homebrew(elf))
      await publish('RACE', homebrew(dwarf), { importJobId: crypto.randomUUID() })
      await settle()
      expect(await rootIds(userSource, await head(userSource), 'RACE')).toEqual([visible])
    } finally {
      await server.close()
    }
  }, 30_000)

  it('follows Campaign shares: an unshared parent excludes its child, unshare removes the item', async () => {
    const { t, server, owner, publish, settle, head, objects, rootIds } = await setup()
    try {
      const campaign = await owner.caller.mutation(api.campaigns.create.create, {
        name: 'Snapshot sharing',
        format: 'ONGOING',
        toneTags: ['HEROIC'],
        contentMaturity: 'STANDARD',
        gameSystemId: srdSystemRecord.id,
        primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
      })
      const ref = { scope: 'CAMPAIGN', scopeId: campaign.id } as const
      const kept = await publish('RACE', homebrew(dwarf))
      const parent = await publish('RACE', homebrew(elf))
      const child = await publish('RACE', homebrew(highElf), { parentId: parent })
      for (const subjectId of [kept, parent, child])
        await owner.caller.mutation(api.campaigns.contentShares.share, {
          campaignId: campaign.id,
          subjectKind: 'RACE',
          subjectId
        })
      await settle()
      const shared = await head(ref)
      expect(await rootIds(ref, shared, 'RACE')).toEqual([kept, parent, child].sort())

      // Only the parent's share row goes, leaving a child share whose parent is not shared.
      await t.run(async (raw) => {
        const ctx = withSceneVisionTracking(raw)
        const share = await ctx.db
          .query('campaignContentShares')
          .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
            q.eq('campaignId', campaign.id).eq('subjectKind', 'RACE').eq('subjectId', parent)
          )
          .unique()
        if (!share) throw new Error('Missing parent share fixture.')
        await ctx.db.delete(share._id)
      })
      await settle()
      expect(await rootIds(ref, await head(ref), 'RACE')).toEqual([kept])

      await owner.caller.mutation(unshare, {
        campaignId: campaign.id,
        subjectKind: 'RACE',
        subjectId: kept,
        sharedBy: owner.userId,
        expectedCampaignVersion: campaign.version,
        commandId: crypto.randomUUID()
      })
      await settle()
      expect((await head(ref))?.kinds.RACE).toBeUndefined()
      const superseded = new Set(
        (await objects()).filter((row) => row.supersededAt !== undefined).map((row) => row.key)
      )
      for (const part of ['index', 'list', 'documents'] as const)
        expect(
          superseded.has(
            contentSnapshotObjectKey(
              { format: 3, ...ref, kind: 'RACE', part },
              shared!.kinds.RACE![part].sha256
            )
          )
        ).toBe(true)
    } finally {
      await server.close()
    }
  }, 30_000)

  it('builds as soon as a pending compilation lands, without waiting out the failure backoff', async () => {
    const { t, server, srdSource, head, rootIds } = await setup()
    try {
      const subjects = [elf, highElf].map((race) =>
        importedSubject({ subjectKind: 'RACE', ...race, document: race })
      )
      // As in the seed, the subrace compiles only after every root exists, so this build waits.
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects
      })
      vi.advanceTimersByTime(CONTENT_SNAPSHOT_BUILD_DELAY_MS)
      await t.finishInProgressScheduledFunctions()
      const waiting = await head(srdSource)
      expect(waiting?.builtRevision).not.toBe(waiting?.revision)

      await syncImportedDerived(t, subjects)
      vi.advanceTimersByTime(CONTENT_SNAPSHOT_BUILD_DELAY_MS)
      await t.finishInProgressScheduledFunctions()
      const built = await head(srdSource)
      expect(built).toMatchObject({ builtRevision: built?.revision })
      expect(built?.failedBuilds).toBeUndefined()
      expect(await rootIds(srdSource, built, 'RACE')).toEqual([elf.id, highElf.id].sort())
    } finally {
      await server.close()
    }
  }, 30_000)

  it('rebuilds only the official source that a platform import changes', async () => {
    const { t, server, userSource, srdSource, publish, settle, head } = await setup()
    try {
      await publish('FEAT', homebrew(grappler))
      await settle()
      const user = await head(userSource)
      await importSeededSubjects(t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [importedSubject({ subjectKind: 'FEAT', ...grappler, document: grappler })]
      })
      await settle()
      expect(await head(userSource)).toEqual(user)
      expect(Object.keys((await head(srdSource))!.kinds)).toEqual(['FEAT'])
    } finally {
      await server.close()
    }
  }, 30_000)

  it('deletes only objects superseded for more than seven days', async () => {
    const { t, server, publish, settle, objects } = await setup()
    try {
      const race = homebrew(elf)
      await publish('RACE', race)
      await settle()
      await publish('RACE', { ...race, label: 'Renamed Elf' })
      await settle()
      const rows = await objects()
      const [expired, recent] = rows.filter((row) => row.supersededAt !== undefined)
      if (!expired || !recent) throw new Error('Expected two superseded objects.')
      await t.run((ctx) => ctx.db.patch(expired._id, { supersededAt: Date.now() - 8 * 86_400_000 }))

      await t.action(internal.contentSnapshots.actions.deleteSupersededObjects, {})
      const remaining = (await objects()).map((row) => row.key).sort()
      expect(remaining).toEqual(
        rows
          .map((row) => row.key)
          .filter((key) => key !== expired.key)
          .sort()
      )
      expect(server.contentSnapshotObjects.has(expired.key)).toBe(false)
      expect([...server.contentSnapshotObjects.keys()].sort()).toEqual(remaining)
    } finally {
      await server.close()
    }
  }, 30_000)
})
