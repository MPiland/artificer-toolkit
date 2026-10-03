import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import {
  equipmentResponseDtoSchema,
  type AuthoredDetailReadInput,
  type AuthoredDetailReadResult
} from '@artificer-toolkit/schema/api/content'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import type {
  AuthoredDraftListInput,
  AuthoredDraftListPage
} from '@artificer-toolkit/schema/api/authoredDrafts'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api, components, internal } from '../_generated/api'
import schema from '../schema'
import authSchema from '../betterAuth/schema'
import { readDetailMeta } from './detailMeta'
import { deleteAuthoredVersion, insertAuthoredVersion } from './documents'
import { versionWithCompilation } from '../../tests/fixtures/publication'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const getDetail = makeFunctionReference<'query', AuthoredDetailReadInput, AuthoredDetailReadResult>(
  'content/details:get'
)
const listDrafts = makeFunctionReference<'query', AuthoredDraftListInput, AuthoredDraftListPage>(
  'content/drafts:list'
)
const system = jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord)))
const document = jsonValueSchema.parse(
  JSON.parse(
    JSON.stringify(srdBaselineContent.subjects.backgrounds.find((item) => item.id === acolyte.id))
  )
)
const source = {
  contentSourceId: SRD_CONTENT_SOURCE.id,
  subjects: [
    {
      subjectKind: 'BACKGROUND' as const,
      id: acolyte.id,
      systemId: acolyte.systemId,
      label: acolyte.label,
      checksum: checksumRuleDocument(document),
      document
    }
  ]
}

async function fixture() {
  const t = convexTest(schema, modules)
  t.registerComponent('betterAuth', authSchema, import.meta.glob('../betterAuth/**/*.*s'))
  await t.mutation(internal.content.import.bootstrap, {
    systems: [
      {
        id: srdSystemRecord.id,
        document: system,
        checksum: checksumRuleDocument(system)
      }
    ],
    contentSource: SRD_CONTENT_SOURCE,
    catalogue: SRD_RULES_CATALOGUE
  })
  await t.mutation(internal.content.import.importSubjects, source)
  const actors = []
  for (let index = 0; index < 2; index++) {
    const user = await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: 'Author',
            email: `draft-${index}@example.invalid`,
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
            token: crypto.randomUUID(),
            expiresAt: Date.now() + 60000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    const caller = t.withIdentity({
      subject: user._id,
      sessionId: session._id
    })
    const identity = await caller.query(api.account.identity, {})
    actors.push({ caller, identity })
  }
  return { t, first: actors[0], second: actors[1] }
}

function input(subjectId: string = crypto.randomUUID()) {
  return {
    subjectKind: 'BACKGROUND' as const,
    subjectId,
    systemId: acolyte.systemId,
    label: 'Unfinished background',
    payload: { details: [] }
  }
}

describe('Convex owned working drafts', () => {
  it('paginates only the current author and requested domain without exposing payloads', async () => {
    const { t, first, second } = await fixture()
    const saved = []
    for (let index = 0; index < 3; index++) {
      saved.push(
        await first.caller.mutation(api.content.drafts.save, {
          ...input(),
          label: `Background ${index}`,
          payload: { description: 'Private full mechanics, not a list field.' }
        })
      )
    }
    await first.caller.mutation(api.content.drafts.save, {
      ...input(),
      subjectKind: 'FEAT'
    })
    const foreign = await second.caller.mutation(api.content.drafts.save, input())
    const request = {
      subjectKind: 'BACKGROUND' as const,
      paginationOpts: { cursor: null, numItems: 1 }
    }
    await expect(t.query(listDrafts, request)).rejects.toThrow('Unauthenticated')
    let cursor: string | null = null
    const summaries: AuthoredDraftListPage['page'] = []
    for (let pageNumber = 0; pageNumber < 3; pageNumber++) {
      const result: AuthoredDraftListPage = await first.caller.query(listDrafts, {
        ...request,
        paginationOpts: { ...request.paginationOpts, cursor }
      })
      expect(result.page).toHaveLength(1)
      summaries.push(...result.page)
      cursor = result.continueCursor
    }
    expect(
      (
        await first.caller.query(listDrafts, {
          ...request,
          paginationOpts: { ...request.paginationOpts, cursor }
        })
      ).isDone
    ).toBe(true)
    expect(summaries.map((draft) => draft.subjectId).sort()).toEqual(
      saved.map((draft) => draft.subjectId).sort()
    )
    for (const summary of summaries) {
      const full = saved.find((draft) => draft.subjectId === summary.subjectId)!
      const { payload: _payload, ...metadata } = full
      expect(summary).toEqual(metadata)
      expect(summary).not.toHaveProperty('_id')
      expect(summary).not.toHaveProperty('payloadJson')
      expect(summary).not.toHaveProperty('basePublishedChecksum')
    }
    expect(
      (await second.caller.query(listDrafts, request)).page.map((draft) => draft.subjectId)
    ).toEqual([foreign.subjectId])
  })

  it('reflects draft edits/discards and rejects owner claims or unbounded page sizes', async () => {
    const { first, second } = await fixture()
    const command = input()
    await first.caller.mutation(api.content.drafts.save, command)
    const request = {
      subjectKind: 'BACKGROUND' as const,
      paginationOpts: { cursor: null, numItems: 48 }
    }
    for (const limit of [0, -1, 49, 1.5]) {
      await expect(
        first.caller.query(listDrafts, {
          ...request,
          paginationOpts: { ...request.paginationOpts, numItems: limit }
        })
      ).rejects.toThrow()
    }
    await expect(
      first.caller.query(listDrafts, {
        ...request,
        userId: second.identity.userId
      } as AuthoredDraftListInput)
    ).rejects.toThrow()
    await first.caller.mutation(api.content.drafts.save, {
      ...command,
      label: 'Recovered edit'
    })
    const result = await first.caller.query(listDrafts, request)
    expect(result.isDone).toBe(true)
    expect(result.page).toHaveLength(1)
    expect(result.page[0].label).toBe('Recovered edit')
    await first.caller.mutation(api.content.drafts.discard, {
      subjectKind: command.subjectKind,
      subjectId: command.subjectId
    })
    expect((await first.caller.query(listDrafts, request)).page).toEqual([])
  })

  it('saves incomplete values with trusted identity, stable routes, and owner-only read/write', async () => {
    const { t, first, second } = await fixture()
    const command = input()
    await expect(t.mutation(api.content.drafts.save, command)).rejects.toThrow('Unauthenticated')
    const saved = await first.caller.mutation(api.content.drafts.save, {
      ...command,
      subjectId: command.subjectId.toUpperCase(),
      payload: {
        userId: second.identity.userId,
        id: acolyte.id,
        systemId: 'forged',
        status: 'ACTIVE',
        details: []
      }
    })
    expect(saved).toMatchObject({
      subjectId: command.subjectId,
      userId: first.identity.userId,
      status: 'DRAFT',
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null
    })
    expect(saved.payload).toMatchObject({
      id: command.subjectId,
      systemId: acolyte.systemId,
      userId: first.identity.userId,
      status: 'DRAFT',
      details: []
    })
    const lookup = {
      subjectKind: command.subjectKind,
      subjectId: command.subjectId
    }
    expect(await second.caller.query(api.content.drafts.get, lookup)).toBeNull()
    await expect(second.caller.mutation(api.content.drafts.save, command)).rejects.toThrow(
      'cannot be edited'
    )
    await expect(second.caller.mutation(api.content.drafts.discard, lookup)).rejects.toThrow(
      'Draft not found'
    )
    const updated = await first.caller.mutation(api.content.drafts.save, {
      ...command,
      label: 'New name'
    })
    expect(updated.publicId).toBe(saved.publicId)
    expect(updated.createdAt).toBe(saved.createdAt)
    expect((await first.caller.query(api.content.drafts.get, lookup))?.label).toBe('New name')
    expect(await t.run((ctx) => ctx.db.query('authoredDrafts').take(3))).toHaveLength(1)
    await expect(
      first.caller.mutation(api.content.drafts.save, {
        ...command,
        subjectKind: 'SPELL'
      })
    ).rejects.toThrow('cannot be edited')
  })

  it('protects master content and copies real SRD mechanics into independent owned UUIDs', async () => {
    const { t, first } = await fixture()
    const lookup = {
      subjectKind: 'BACKGROUND' as const,
      subjectId: acolyte.id
    }
    await expect(first.caller.mutation(api.content.drafts.save, input(acolyte.id))).rejects.toThrow(
      'cannot be edited'
    )
    const original = await t.run((ctx) => ctx.db.query('authoredVersions').take(2))
    const copy = await first.caller.mutation(api.content.drafts.duplicate, lookup)
    expect(copy.subjectId).not.toBe(acolyte.id)
    expect(copy.label).toBe('Acolyte Copy')
    expect(copy.userId).toBe(first.identity.userId)
    const payload = copy.payload as {
      features: { id: string }[]
      proficiencies: { id: string; skillIds?: string[] }[]
    }
    expect(payload.features[0].id).not.toBe(acolyte.features?.[0].id)
    expect(payload.proficiencies[0].id).not.toBe(acolyte.proficiencies?.[0].id)
    const originalGrant = acolyte.proficiencies?.[0]
    if (!originalGrant || !('skillIds' in originalGrant))
      throw new Error('Missing canonical skill grant')
    expect(payload.proficiencies[0].skillIds).toEqual(originalGrant.skillIds)
    expect(await t.run((ctx) => ctx.db.query('authoredVersions').take(2))).toEqual(original)
  })

  it('enforces the 20-root FREE quota, allows updates at the cap, and frees discarded roots', async () => {
    const { t, first } = await fixture()
    const commands = Array.from({ length: 20 }, () => input())
    for (const command of commands) await first.caller.mutation(api.content.drafts.save, command)
    const before = await t.run((ctx) => ctx.db.query('authoredRouteSequence').take(1))
    await expect(first.caller.mutation(api.content.drafts.save, input())).rejects.toThrow(
      'homebrewRoots limit'
    )
    await expect(
      first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind: 'BACKGROUND',
        subjectId: acolyte.id
      })
    ).rejects.toThrow('homebrewRoots limit')
    expect(await t.run((ctx) => ctx.db.query('authoredRouteSequence').take(1))).toEqual(before)
    const updated = await first.caller.mutation(api.content.drafts.save, commands[19])
    await first.caller.mutation(api.content.drafts.discard, {
      subjectKind: 'BACKGROUND',
      subjectId: commands[19].subjectId
    })
    const replacement = await first.caller.mutation(api.content.drafts.save, input())
    expect(replacement.publicId).not.toBe(updated.publicId)
    expect(await t.run((ctx) => ctx.db.query('authoredDrafts').take(21))).toHaveLength(20)
  })

  it('reads server-owned paid entitlement and never accepts a client tier override', async () => {
    const { t, first } = await fixture()
    const forged = { ...input(), tier: 'PLAYER' }
    await expect(first.caller.mutation(api.content.drafts.save, forged)).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('authoredDrafts').take(1))).toHaveLength(0)
    await t.run((ctx) =>
      ctx.db.insert('accountEntitlements', {
        userId: first.identity.userId,
        tier: 'PLAYER'
      })
    )
    for (let index = 0; index < 21; index++)
      await first.caller.mutation(api.content.drafts.save, input())
    expect(await t.run((ctx) => ctx.db.query('authoredDrafts').take(22))).toHaveLength(21)
  })

  it('rejects corrupt source evidence before creating a draft or consuming a route number', async () => {
    const { t, first } = await fixture()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
        .unique()
      if (!root) throw new Error('Missing fixture root')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Missing fixture version')
      const chunk = await ctx.db
        .query('authoredVersionPayloadChunks')
        .withIndex('by_versionId_chunkIndex', (query) => query.eq('versionId', version.versionId))
        .first()
      if (!chunk) throw new Error('Missing fixture version chunk')
      const corrupted = chunk.bytes.slice(0)
      const corruptedBytes = new Uint8Array(corrupted)
      corruptedBytes[0] = (corruptedBytes[0] ?? 0) ^ 1
      await ctx.db.patch(chunk._id, { bytes: corrupted })
    })
    await expect(
      first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind: 'BACKGROUND',
        subjectId: acolyte.id
      })
    ).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('authoredDrafts').take(1))).toHaveLength(0)
  })

  it('preserves seeded compact URLs and keeps route allocation idempotent', async () => {
    const { t } = await fixture()
    const routes = await t.run((ctx) => ctx.db.query('authoredRouteIds').take(3))
    const [, , , domain, index] = acolyte.id.split('-')
    expect(routes[0].publicId).toBe(
      (Number.parseInt(domain, 16) * 100000 + Number.parseInt(index.slice(0, 4), 16)).toString(36)
    )
    await t.mutation(internal.content.import.importSubjects, source)
    expect(await t.run((ctx) => ctx.db.query('authoredRouteIds').take(3))).toEqual(routes)
  })

  it('does not allocate a draft inside the reserved canonical SRD URL range', async () => {
    const { t, first } = await fixture()
    const draft = await first.caller.mutation(api.content.drafts.save, input())
    const [, , , domain, index] = acolyte.id.split('-')
    const nextIndex = (Number.parseInt(index.slice(0, 4), 16) + 1).toString(16).padStart(4, '0')
    const id = `00000000-0000-0000-${domain}-${nextIndex}00000000`
    const next = jsonValueSchema.parse(JSON.parse(JSON.stringify({ ...acolyte, id })))
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        {
          ...source.subjects[0],
          id,
          document: next,
          checksum: checksumRuleDocument(next)
        }
      ]
    })
    const route = await t.run((ctx) =>
      ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', id))
        .unique()
    )
    expect(route?.publicId).toBe(
      (Number.parseInt(domain, 16) * 100000 + Number.parseInt(nextIndex, 16)).toString(36)
    )
    expect(draft.publicId).not.toBe(route?.publicId)
  })

  it('counts an owned published root and its edit once, freezes its base, and retains it on discard', async () => {
    const { t, first, second } = await fixture()
    const copy = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    // Materialize published state for this repository test; publication is a separate case.
    const published = jsonValueSchema.parse({
      ...copy.payload,
      status: 'ACTIVE'
    })
    const checksum = checksumRuleDocument(published)
    const version = await t.run(async (ctx) => {
      const userSourceId = '10000000-0000-4000-8000-000000000094'
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: userSourceId,
        kind: 'USER',
        ownerUserId: first.identity.userId
      })
      const publicVersionId = crypto.randomUUID()
      const currentVersionId = await ctx.db.insert('authoredVersions', {
        subjectKind: 'BACKGROUND',
        id: copy.subjectId,
        systemId: acolyte.systemId,
        label: copy.label,
        checksum,
        contentSourceId: userSourceId,
        versionId: publicVersionId,
        version: 1,
        documentSchemaVersion: 1,
        documentJson: JSON.stringify(published)
      })
      await ctx.db.insert('authoredRoots', {
        id: copy.subjectId,
        subjectKind: 'BACKGROUND',
        systemId: acolyte.systemId,
        label: copy.label,
        checksum,
        contentSourceId: userSourceId,
        ownerUserId: first.identity.userId,
        currentVersionId,
        currentVersionPublicId: publicVersionId
      })
      const initialDraft = await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', copy.subjectId))
        .unique()
      if (!initialDraft) throw new Error('Missing copied draft')
      await ctx.db.delete(initialDraft._id)
      return ctx.db.get(currentVersionId)
    })
    if (!version) throw new Error('Missing published fixture')
    const lookup = { subjectKind: 'BACKGROUND' as const, id: copy.publicId }
    expect(await t.query(getDetail, lookup)).toBeNull()
    expect(await second.caller.query(getDetail, lookup)).toBeNull()
    const active = await first.caller.query(getDetail, lookup)
    expect(active).toMatchObject({
      item: published,
      hasDraft: false,
      permissions: { canEdit: true }
    })
    const edit = await first.caller.mutation(api.content.drafts.save, {
      ...input(copy.subjectId),
      payload: copy.payload
    })
    expect(edit.baseActiveUpdatedAt).toBe(new Date(version._creationTime).toISOString())
    expect(edit.draftState).toBe('ACTIVE_WITH_DRAFT')
    expect(await first.caller.query(getDetail, lookup)).toMatchObject({
      item: published,
      hasDraft: true
    })
    expect(await first.caller.query(getDetail, lookup)).not.toHaveProperty('draft')
    expect(await first.caller.query(getDetail, { ...lookup, view: 'draft' })).toMatchObject({
      item: { status: 'DRAFT' },
      draft: edit
    })
    for (let index = 0; index < 19; index++)
      await first.caller.mutation(api.content.drafts.save, input())
    await expect(first.caller.mutation(api.content.drafts.save, input())).rejects.toThrow(
      'homebrewRoots limit'
    )
    const updated = await first.caller.mutation(api.content.drafts.save, {
      ...input(copy.subjectId),
      payload: { features: 'unfinished' }
    })
    const recovery = await first.caller.query(getDetail, {
      ...lookup,
      view: 'draft'
    })
    expect(recovery).toMatchObject({ item: published, draft: updated })
    expect(recovery?.validationIssues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['features'] })])
    )
    expect(updated.baseActiveUpdatedAt).toBe(edit.baseActiveUpdatedAt)
    const stored = await t.run((ctx) =>
      ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', copy.subjectId))
        .unique()
    )
    expect(stored?.basePublishedChecksum).toBe(checksum)
    await first.caller.mutation(api.content.drafts.discard, {
      subjectKind: 'BACKGROUND',
      subjectId: copy.subjectId
    })
    await expect(first.caller.mutation(api.content.drafts.save, input())).rejects.toThrow(
      'homebrewRoots limit'
    )
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', copy.subjectId))
          .unique()
      )
    ).toMatchObject({ publicId: copy.publicId })
    expect(await t.run((ctx) => ctx.db.get(version._id))).toEqual(version)
  })
})

describe('Convex authored detail reads', () => {
  it('reads and losslessly duplicates all eight domains through the native boundary', async () => {
    const { t, first } = await fixture()
    const withoutUuidValues = (value: unknown) =>
      JSON.parse(
        JSON.stringify(value, (key, entry: unknown) =>
          typeof entry === 'string' &&
          (key === 'id' || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(entry))
            ? '<uuid>'
            : entry
        )
      )
    const groups = [
      ['BACKGROUND', srdBaselineContent.subjects.backgrounds],
      ['CLASS', srdBaselineContent.subjects.classes],
      ['CREATURE', srdBaselineContent.subjects.creatures],
      ['EQUIPMENT', srdBaselineContent.subjects.equipment],
      ['FEAT', srdBaselineContent.subjects.feats],
      ['RACE', srdBaselineContent.subjects.races],
      ['SPELL', srdBaselineContent.subjects.spells],
      ['VEHICLE', srdBaselineContent.subjects.vehicles]
    ] as const
    for (const [subjectKind, records] of groups) {
      const item = records[0]
      const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(item)))
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [
          {
            subjectKind,
            id: item.id,
            systemId: item.systemId,
            label: item.label,
            checksum: checksumRuleDocument(document),
            document
          }
        ]
      })
      const detail = await t.query(getDetail, {
        subjectKind,
        id: item.id.toUpperCase()
      })
      expect(detail?.item).toEqual(document)
      expect(detail).toMatchObject({
        hasDraft: false,
        provenance: { kind: 'MASTER', ownerUserId: null },
        permissions: {
          canView: true,
          canCopy: false,
          canEdit: false,
          canDelete: false
        }
      })
      expect(JSON.stringify(detail)).not.toMatch(
        /"(_id|_creationTime|checksum|versionId|documentJson)"/
      )
      expect(detail).not.toHaveProperty('draft')
      expect(await t.query(getDetail, { subjectKind, id: detail!.publicId })).toEqual(detail)
      expect(
        (await first.caller.query(getDetail, { subjectKind, id: item.id }))?.permissions.canCopy
      ).toBe(true)
      const copy = await first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind,
        subjectId: item.id
      })
      expect(copy.subjectId).not.toBe(item.id)
      expect(copy.userId).toBe(first.identity.userId)
      expect(copy.systemId).toBe(item.systemId)
      expect(copy.payload.id).toBe(copy.subjectId)
      expect(copy.payload.userId).toBe(first.identity.userId)
      // The corpus clone test proves UUID reference semantics; this checks the transport
      // retains every nested field and value after server identity/status normalization.
      expect(withoutUuidValues(copy.payload)).toEqual(
        withoutUuidValues({
          ...item,
          kind: subjectKind,
          label: `${item.label} Copy`,
          userId: first.identity.userId,
          status: 'DRAFT'
        })
      )
      expect((await t.query(getDetail, { subjectKind, id: item.id }))?.item).toEqual(document)
      expect(
        await t.query(getDetail, {
          subjectKind: subjectKind === 'BACKGROUND' ? 'SPELL' : 'BACKGROUND',
          id: detail!.publicId
        })
      ).toBeNull()
    }
  }, 30000)

  it('keeps draft-only content owner-private, supports both route forms, and preserves invalid values for repair', async () => {
    const { t, first, second } = await fixture()
    const copy = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    for (const id of [copy.subjectId.toUpperCase(), copy.publicId]) {
      const lookup = {
        subjectKind: 'BACKGROUND' as const,
        id,
        view: 'draft' as const
      }
      expect(await t.query(getDetail, lookup)).toBeNull()
      expect(await second.caller.query(getDetail, lookup)).toBeNull()
      expect(await first.caller.query(getDetail, { ...lookup, view: 'active' })).toBeNull()
      expect(await first.caller.query(getDetail, lookup)).toMatchObject({
        item: copy.payload,
        draft: copy,
        activeUpdatedAt: null,
        permissions: { canCopy: false, canEdit: true }
      })
    }
    const saved = await first.caller.mutation(api.content.drafts.save, {
      ...input(copy.subjectId),
      payload: { features: 'unfinished' }
    })
    const detail = await first.caller.query(getDetail, {
      subjectKind: 'BACKGROUND',
      id: copy.publicId,
      view: 'draft'
    })
    expect(detail).toMatchObject({ item: null, draft: saved })
    expect(detail?.validationIssues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['features'] })])
    )
  })

  it('returns only requested, actually referenced System vocabulary', async () => {
    const { t } = await fixture()
    const detail = await t.query(getDetail, {
      subjectKind: 'BACKGROUND',
      id: acolyte.id,
      meta: ['skills', 'skills', 'currencies', 'unrecognized']
    })
    const expectedSkills = srdSystemRecord.skills
      .filter((skill) => ['INSIGHT', 'RELIGION'].includes(skill.code))
      .map((skill) => ({ value: skill.id, label: skill.label }))
      .sort((a, b) => a.label.localeCompare(b.label))
    expect(detail?.meta).toEqual({
      skills: expectedSkills,
      currencies: [
        {
          value: '00000000-0000-0000-0003-000400000000',
          label: srdSystemRecord.currencies.find((currency) => currency.code === 'GP')!.label
        }
      ]
    })
    expect(
      (await t.query(getDetail, { subjectKind: 'BACKGROUND', id: acolyte.id }))?.meta
    ).toBeUndefined()
  })

  it('resolves Equipment economy and restriction labels without exposing unreadable class references', async () => {
    const { t, first, second } = await fixture()
    const equipment = srdBaselineContent.subjects.equipment.find((item) => item.label === 'Mace')!
    const classes = srdBaselineContent.subjects.classes
      .filter((item) => item.category === 'BASE')
      .slice(0, 3)
    expect(classes).toHaveLength(3)
    for (const { subjectKind, item } of [
      { subjectKind: 'EQUIPMENT' as const, item: equipment },
      ...classes.map((item) => ({ subjectKind: 'CLASS' as const, item }))
    ]) {
      const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(item)))
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [
          {
            subjectKind,
            id: item.id,
            label: item.label,
            systemId: item.systemId,
            checksum: checksumRuleDocument(document),
            document
          }
        ]
      })
    }
    await t.run(async (ctx) => {
      for (const [index, item] of classes.entries()) {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', item.id))
          .unique()
        if (!root) throw new Error('Missing class reference fixture')
        if (index === 1) await ctx.db.patch(root._id, { systemId: crypto.randomUUID() })
        if (index === 2) await ctx.db.patch(root._id, { ownerUserId: second.identity.userId })
      }
    })
    const copy = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: equipment.id
    })
    const heritage = srdSystemRecord.heritages[0]
    const payload = equipmentAuthoredDtoSchema.parse({
      ...equipmentAuthoredDtoSchema.parse(copy.payload),
      restrictions: {
        id: crypto.randomUUID(),
        groups: [
          {
            id: crypto.randomUUID(),
            order: 1,
            contexts: [
              {
                id: crypto.randomUUID(),
                order: 1,
                subject: 'CHARACTER',
                conditions: [
                  {
                    id: crypto.randomUUID(),
                    order: 1,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'CLASS_LEVEL',
                    classIds: [...classes.map((item) => item.id), acolyte.id],
                    min: 1
                  },
                  {
                    id: crypto.randomUUID(),
                    order: 2,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'HERITAGE',
                    authoringModeKind: 'SELECTED',
                    heritageIds: [heritage.id]
                  }
                ]
              }
            ]
          }
        ]
      }
    })
    await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: copy.subjectId,
      systemId: copy.systemId,
      label: copy.label,
      payload
    })
    const detail = equipmentResponseDtoSchema.parse(
      await first.caller.query(getDetail, {
        subjectKind: 'EQUIPMENT',
        id: copy.publicId,
        view: 'draft',
        meta: ['classes', 'currencies', 'equipment', 'heritages', 'rarities']
      })
    )
    expect(detail?.meta).toEqual({
      classes: [{ value: classes[0].id, label: classes[0].label }],
      currencies: srdSystemRecord.currencies
        .filter(
          (item) => equipment.category !== 'VARIANT' && item.id === equipment.cost?.currencyId
        )
        .map((item) => ({ value: item.id, label: item.label })),
      equipment: [],
      heritages: [{ value: heritage.id, label: heritage.label }],
      rarities: srdSystemRecord.rarities
        .filter((item) => item.id === equipment.rarityId)
        .map((item) => ({ value: item.id, label: item.label }))
    })
    expect(
      await second.caller.query(getDetail, {
        subjectKind: 'EQUIPMENT',
        id: copy.publicId,
        view: 'draft',
        meta: ['classes', 'heritages']
      })
    ).toBeNull()
  })

  it('omits foreign, cross-System and wrong-kind labels from referenced equipment', async () => {
    const { t, first, second } = await fixture()
    const equipment = srdBaselineContent.subjects.equipment.slice(0, 4)
    for (const item of equipment) {
      const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(item)))
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [
          {
            subjectKind: 'EQUIPMENT',
            id: item.id,
            label: item.label,
            systemId: item.systemId,
            checksum: checksumRuleDocument(document),
            document
          }
        ]
      })
    }
    await t.run(async (ctx) => {
      const privateSourceId = '10000000-0000-4000-8000-000000000095'
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: privateSourceId,
        kind: 'USER',
        ownerUserId: second.identity.userId
      })
      for (const [index, item] of equipment.entries()) {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', item.id))
          .unique()
        if (!root) throw new Error('Missing fixture root')
        if (index === 1) {
          const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
          if (!version) throw new Error('Missing equipment version fixture')
          const document = { ...item, userId: second.identity.userId }
          const checksum = checksumRuleDocument(document)
          await deleteAuthoredVersion(ctx, version)
          const currentVersionId = await insertAuthoredVersion(
            ctx,
            {
              subjectKind: version.subjectKind,
              id: version.id,
              systemId: version.systemId,
              label: version.label,
              checksum,
              contentSourceId: privateSourceId,
              versionId: version.versionId,
              version: version.version,
              documentSchemaVersion: version.documentSchemaVersion
            },
            canonicalizeRuleDocument(document),
            version.compilation
          )
          await ctx.db.patch(root._id, {
            ownerUserId: second.identity.userId,
            contentSourceId: privateSourceId,
            checksum,
            currentVersionId
          })
        }
        if (index === 2) await ctx.db.patch(root._id, { systemId: crypto.randomUUID() })
        if (index === 3) await ctx.db.patch(root._id, { subjectKind: 'RACE' })
      }
    })
    const meta = await t.run((ctx) =>
      readDetailMeta(
        ctx,
        { subjectKind: 'CREATURE', id: acolyte.id, meta: ['equipment'] },
        {
          systemId: acolyte.systemId,
          equipmentLoadout: [...equipment, equipment[0]].map((item) => ({
            equipmentId: item.id
          }))
        },
        first.identity.userId
      )
    )
    expect(meta).toEqual({
      equipment: [{ value: equipment[0].id, label: equipment[0].label }]
    })
    expect(
      await t.query(getDetail, {
        subjectKind: 'EQUIPMENT',
        id: equipment[1].id
      })
    ).toBeNull()
    expect(
      await second.caller.query(getDetail, {
        subjectKind: 'EQUIPMENT',
        id: equipment[1].id
      })
    ).toMatchObject({
      item: { id: equipment[1].id, userId: second.identity.userId }
    })
    expect(
      await first.caller.query(getDetail, {
        subjectKind: 'EQUIPMENT',
        id: equipment[1].id
      })
    ).toBeNull()
  })

  it('fails closed for source rebinding and corrupt published evidence', async () => {
    const { t } = await fixture()
    const root = await t.run((ctx) =>
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
        .unique()
    )
    if (!root) throw new Error('Missing fixture root')
    await t.run((ctx) => ctx.db.patch(root._id, { contentSourceId: crypto.randomUUID() }))
    expect(await t.query(getDetail, { subjectKind: 'BACKGROUND', id: acolyte.id })).toBeNull()
    await t.run((ctx) =>
      ctx.db.patch(root._id, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        systemId: crypto.randomUUID()
      })
    )
    expect(await t.query(getDetail, { subjectKind: 'BACKGROUND', id: acolyte.id })).toBeNull()
    await t.run(async (ctx) => {
      await ctx.db.patch(root._id, { systemId: acolyte.systemId })
      await ctx.db.patch(root.currentVersionId, { id: crypto.randomUUID() })
    })
    await expect(t.query(getDetail, { subjectKind: 'BACKGROUND', id: acolyte.id })).rejects.toThrow(
      'identity mismatch'
    )
    await t.run(async (ctx) => {
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Missing fixture version')
      await ctx.db.patch(version._id, { id: acolyte.id })
      const chunk = await ctx.db
        .query('authoredVersionPayloadChunks')
        .withIndex('by_versionId_chunkIndex', (query) => query.eq('versionId', version.versionId))
        .first()
      if (!chunk) throw new Error('Missing fixture version chunk')
      const corrupted = chunk.bytes.slice(0)
      const corruptedBytes = new Uint8Array(corrupted)
      corruptedBytes[0] = (corruptedBytes[0] ?? 0) ^ 1
      await ctx.db.patch(chunk._id, { bytes: corrupted })
    })
    await expect(
      t.query(getDetail, { subjectKind: 'BACKGROUND', id: acolyte.id })
    ).rejects.toThrow()
  })

  it('enforces read argument bounds before lookup', async () => {
    const { t } = await fixture()
    await expect(
      t.query(getDetail, { subjectKind: 'BACKGROUND', id: 'x'.repeat(65) })
    ).rejects.toThrow()
    await expect(
      t.query(getDetail, {
        subjectKind: 'BACKGROUND',
        id: acolyte.id,
        meta: Array(17).fill('skills')
      })
    ).rejects.toThrow()
    expect(
      await t.query(getDetail, {
        subjectKind: 'BACKGROUND',
        id: crypto.randomUUID()
      })
    ).toBeNull()
  })
})
