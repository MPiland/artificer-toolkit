import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type {
  LiveSessionCharacterRulesInput,
  LiveSessionCharacterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  canonicalizeRuleDocument,
  checksumRuleDocument
} from '@artificer-toolkit/shared/rules/checksum'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, makePublishedRootOwned } from '../../tests/fixtures/publication'
import { internal } from '../_generated/api'
import { characterStoredRowSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { readCharacterSheetState } from '../characters/sheetStateDocuments'
import { readCampaignCharacterState } from '../campaigns/characterState'
import { readCampaignCurrencyOptions } from '../campaigns/currencySystemDocuments'
import { requireSystem } from '../content/systemDocuments'
import { insertAuthoredVersion } from '../content/documents'
import * as publicationDocuments from '../content/documents'
import { insertActiveLiveAuthority } from '../../tests/fixtures/liveSessionWorker'

const capture = makeFunctionReference<
  'query',
  LiveSessionCharacterRulesInput,
  LiveSessionCharacterRulesResponse
>('liveSessions/characterRulesCapture:capture')
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)

async function setup() {
  const base = await readySheetFixture()
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Character rules capture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: base.character.systemId,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const epoch = crypto.randomUUID()
  const assignmentId = await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    await insertActiveLiveAuthority(ctx, {
      campaignId: campaign.id,
      epoch,
      createdAt: campaign.createdAt
    })
    return ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      characterId: base.character.id,
      assignedAt: campaign.createdAt
    })
  })
  const { character: stored } = await base.readState()
  if (!stored) throw new Error('Missing Character fixture.')
  const input: LiveSessionCharacterRulesInput = {
    campaignId: campaign.id,
    authorityEpoch: epoch,
    expectedUserId: base.other.userId,
    expectedRole: 'OWNER',
    characterId: base.character.id,
    request: { kind: 'INPUTS' }
  }
  return { ...base, campaign, stored, input, assignmentId }
}

async function captureSourceIndex(
  base: Awaited<ReturnType<typeof setup>>,
  input: LiveSessionCharacterRulesInput
) {
  if (input.request.kind === 'INPUTS' || input.request.kind === 'PUBLICATIONS')
    throw new Error('Expected source index request.')
  const sources: Extract<LiveSessionCharacterRulesResponse, { kind: 'SOURCE_INDEX' }>['sources'] =
    []
  const checksums: string[] = []
  let cursor: Extract<
    LiveSessionCharacterRulesResponse,
    { kind: 'SOURCE_INDEX' }
  >['continueCursor'] = null
  for (;;) {
    const page: LiveSessionCharacterRulesResponse = await base.other.caller.query(capture, {
      ...input,
      request: { ...input.request, ...(cursor ? { cursor } : {}) }
    })
    if (page.kind !== 'SOURCE_INDEX') throw new Error('Expected source index.')
    sources.push(...page.sources)
    checksums.push(page.readChecksum)
    if (page.continueCursor === null)
      return { ...page, sources, readChecksum: checksumRuleDocument(checksums) }
    cursor = page.continueCursor
    if (checksums.length > 100) throw new Error('Source pages did not terminate.')
  }
}

it('captures the assigned player Character stored inputs for the GM and rejects stale or wrong authority', async () => {
  const base = await setup()
  const response = await base.other.caller.query(capture, base.input)
  const expected = await base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing Campaign fixture.')
    return {
      kind: 'INPUTS',
      owner: characterStoredRowSchema.parse(base.stored),
      sheetState: readCharacterSheetState(base.stored),
      system: await requireSystem(ctx, base.stored.systemId),
      campaign: {
        id: campaign.id,
        status: campaign.status,
        contentMaturity: campaign.contentMaturity,
        attunementSlotOverride: campaign.attunementSlotOverride,
        state: (await readCampaignCharacterState(ctx, campaign.id, base.character.id)).state,
        currencyOptions: await readCampaignCurrencyOptions(ctx, campaign)
      }
    }
  })
  expect(response).toEqual({
    ...expected,
    readChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
    revisions: expect.arrayContaining([
      { scope: 'SYSTEM', id: base.stored.systemId, revision: expect.any(String) },
      { scope: 'CAMPAIGN', id: base.campaign.id, revision: expect.any(String) },
      // Creating the Campaign's play settings sets its PLAY revision.
      { scope: 'PLAY', id: base.campaign.id, revision: expect.any(String) },
      { scope: 'CHARACTER', id: base.character.id, revision: expect.any(String) }
    ])
  })
  expect(await base.other.caller.query(capture, base.input)).toEqual(response)
  await expect(base.t.query(capture, base.input)).rejects.toThrow('Unauthenticated')
  await expect(
    base.other.caller.query(capture, { ...base.input, expectedUserId: base.owner.userId })
  ).rejects.toThrow('identity')
  await expect(
    base.owner.caller.query(capture, { ...base.input, expectedUserId: base.owner.userId })
  ).rejects.toThrow('role')
  await expect(
    base.other.caller.query(capture, { ...base.input, authorityEpoch: crypto.randomUUID() })
  ).rejects.toThrow('stale')
  await base.t.run((ctx) => ctx.db.delete(base.assignmentId))
  await expect(base.other.caller.query(capture, base.input)).rejects.toThrow('Assigned Character')
})

it('fingerprints new catalogue members and Campaign share access without granting the GM private sources', async () => {
  const base = await setup()
  const input = { ...base.input, request: { kind: 'CLASS_CATALOGUE' as const } }
  const before = await captureSourceIndex(base, input)
  const extra = { ...base.baseClass, id: crypto.randomUUID(), label: 'Another class' }
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'CLASS', ...extra, document: extra })]
  })
  const added = await captureSourceIndex(base, input)
  expect(added.readChecksum).not.toBe(before.readChecksum)
  expect(added).toMatchObject({
    kind: 'SOURCE_INDEX',
    sources: expect.arrayContaining([expect.objectContaining({ subjectId: extra.id })])
  })
  await base.t.run((ctx) => makePublishedRootOwned(ctx, extra.id, base.other.userId))
  const privateSource = await captureSourceIndex(base, input)
  expect(privateSource).toEqual({ ...before, revisions: privateSource.revisions })
  expect(privateSource.revisions).not.toEqual(before.revisions)
  const shareId = await base.t.run((ctx) =>
    ctx.db.insert('campaignContentShares', {
      campaignId: base.campaign.id,
      subjectKind: 'CLASS',
      subjectId: extra.id,
      sharedBy: base.other.userId,
      createdAt: base.campaign.createdAt,
      updatedAt: base.campaign.createdAt
    })
  )
  const shared = await captureSourceIndex(base, input)
  expect(shared.readChecksum).not.toBe(privateSource.readChecksum)
  expect(shared).toMatchObject({
    kind: 'SOURCE_INDEX',
    sources: expect.arrayContaining([expect.objectContaining({ subjectId: extra.id })])
  })
  await base.t.run((ctx) => ctx.db.delete(shareId))
  const removedShare = await captureSourceIndex(base, input)
  expect(removedShare).toEqual({ ...before, revisions: removedShare.revisions })
})

it('binds feature matches to checked metadata and fingerprints missing publications becoming available', async () => {
  const base = await setup()
  const featureId = crypto.randomUUID()
  const featureInput = {
    ...base.input,
    request: { kind: 'FEATURE_SOURCES' as const, featureIds: [featureId] }
  }
  const before = await captureSourceIndex(base, featureInput)
  expect(before.sources.filter((source) => source.matches)).toEqual([])
  expect(before.sources).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ subjectId: base.baseClass.id, matches: false })
    ])
  )
  await base.t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', base.baseClass.id))
      .unique()
    if (!root || !root.authoringSources) throw new Error('Missing source facts fixture.')
    await ctx.db.patch(root._id, {
      authoringSources: {
        ...root.authoringSources,
        rows: { ...root.authoringSources.rows, features: [{ id: featureId, label: 'Feature' }] }
      }
    })
  })
  const matched = await captureSourceIndex(base, featureInput)
  expect(matched.readChecksum).not.toBe(before.readChecksum)
  expect(matched.sources.filter((source) => source.matches)).toEqual([
    expect.objectContaining({ subjectId: base.baseClass.id, matches: true })
  ])
  const extra = { ...base.baseClass, id: crypto.randomUUID(), label: 'Previously missing' }
  const publicationInput = {
    ...base.input,
    request: { kind: 'PUBLICATIONS' as const, subjectIds: [extra.id], afterSubjectId: null }
  }
  const missing = await base.other.caller.query(capture, publicationInput)
  expect(missing).toMatchObject({ kind: 'PUBLICATIONS', publications: [], continueAfter: null })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'CLASS', ...extra, document: extra })]
  })
  const found = await base.other.caller.query(capture, publicationInput)
  expect(found.readChecksum).not.toBe(missing.readChecksum)
  expect(found).toMatchObject({
    publications: [{ identity: expect.objectContaining({ subjectId: extra.id }) }]
  })
  await base.t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', base.baseClass.id))
      .unique()
    if (!root || !root.authoringSources) throw new Error('Missing source facts fixture.')
    await ctx.db.patch(root._id, {
      authoringSources: { ...root.authoringSources, checksum: '0'.repeat(64) }
    })
  })
  await expect(captureSourceIndex(base, featureInput)).rejects.toThrow('source checksum')
})

it('pages before the next payload read, keeps missing ID coverage, and permits a single large publication', async () => {
  const base = await setup()
  const ids = [
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003'
  ]
  for (const [index, id] of ids.entries()) {
    await base.t.run(async (ctx) => {
      const source = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', base.baseClass.id))
        .unique()
      if (!source) throw new Error('Missing source fixture.')
      const version = await ctx.db.get(source.currentVersionId)
      if (!version) throw new Error('Missing version fixture.')
      const document = {
        ...base.baseClass,
        id,
        details: Array.from({ length: index === 2 ? 80 : 45 }, (_, order) => ({
          id: crypto.randomUUID(),
          label: 'Large detail',
          order,
          description: '<p data-padding="' + 'x'.repeat(70_000) + '">Detail</p>'
        }))
      }
      const checksum = checksumRuleDocument(document)
      const versionId = crypto.randomUUID()
      const {
        _id: _versionId,
        _creationTime: _versionTime,
        documentJson: _document,
        documentByteLength: _bytes,
        documentChunkCount: _chunks,
        ...metadata
      } = version
      const currentVersionId = await insertAuthoredVersion(
        ctx,
        { ...metadata, id, versionId, checksum },
        canonicalizeRuleDocument(document)
      )
      const { _id: _rootId, _creationTime: _rootTime, ...root } = source
      await ctx.db.insert('authoredRoots', {
        ...root,
        id,
        checksum,
        currentVersionId,
        currentVersionPublicId: versionId
      })
    })
  }
  const missingId = '00000000-0000-4000-8000-000000000004'
  const request = {
    kind: 'PUBLICATIONS' as const,
    subjectIds: [ids[2]!, ids[0]!, missingId, ids[1]!, ids[0]!],
    afterSubjectId: null
  }
  const first = await base.other.caller.query(capture, { ...base.input, request })
  expect(first).toMatchObject({
    kind: 'PUBLICATIONS',
    continueAfter: ids[0],
    publications: [{ identity: expect.objectContaining({ subjectId: ids[0] }) }]
  })
  const second = await base.other.caller.query(capture, {
    ...base.input,
    request: { ...request, afterSubjectId: ids[0]! }
  })
  expect(second).toMatchObject({
    continueAfter: ids[1],
    publications: [{ identity: expect.objectContaining({ subjectId: ids[1] }) }]
  })
  const last = await base.other.caller.query(capture, {
    ...base.input,
    request: { ...request, afterSubjectId: ids[1]! }
  })
  expect(last).toMatchObject({
    continueAfter: null,
    publications: [{ identity: expect.objectContaining({ subjectId: ids[2] }) }]
  })
  if (last.kind !== 'PUBLICATIONS') throw new Error('Expected publications.')
  expect(JSON.parse(last.publications[0]!.documentJson).details).toHaveLength(80)
  const empty = await base.other.caller.query(capture, {
    ...base.input,
    request: { ...request, afterSubjectId: ids[2]! }
  })
  expect(empty).toMatchObject({ continueAfter: null, publications: [] })
})

it('pages source metadata and missing IDs without hydrating shared publication bodies', async () => {
  const base = await setup()
  const extra = Array.from({ length: 6 }, (_, index) => ({
    ...base.baseClass,
    id: crypto.randomUUID(),
    label: `Shared catalogue class ${index}`
  }))
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: extra.map((document) =>
      importedSubject({ subjectKind: 'CLASS', ...document, document })
    )
  })
  for (const document of extra) {
    await base.t.run(async (ctx) => {
      await makePublishedRootOwned(ctx, document.id, base.other.userId)
      await ctx.db.insert('campaignContentShares', {
        campaignId: base.campaign.id,
        subjectKind: 'CLASS',
        subjectId: document.id,
        sharedBy: base.other.userId,
        createdAt: base.campaign.createdAt,
        updatedAt: base.campaign.createdAt
      })
    })
  }
  const readBody = vi.spyOn(publicationDocuments, 'readPublishedDocument')
  try {
    let cursor: Extract<
      LiveSessionCharacterRulesResponse,
      { kind: 'SOURCE_INDEX' }
    >['continueCursor'] = null
    const found = new Set<string>()
    let pages = 0
    do {
      const page: LiveSessionCharacterRulesResponse = await base.other.caller.query(capture, {
        ...base.input,
        request: { kind: 'CLASS_CATALOGUE' as const, ...(cursor ? { cursor } : {}) }
      })
      if (page.kind !== 'SOURCE_INDEX') throw new Error('Missing source index.')
      expect(page.sources.length).toBeLessThanOrEqual(4)
      for (const source of page.sources) found.add(source.subjectId)
      cursor = page.continueCursor
      pages++
      expect(pages).toBeLessThan(10)
    } while (cursor)
    expect(pages).toBeGreaterThan(1)
    expect([...found]).toEqual(expect.arrayContaining(extra.map((document) => document.id)))
    expect(readBody).not.toHaveBeenCalled()

    const missingIds = Array.from({ length: 9 }, () => crypto.randomUUID()).sort()
    const missing = await base.other.caller.query(capture, {
      ...base.input,
      request: { kind: 'PUBLICATIONS', subjectIds: missingIds, afterSubjectId: null }
    })
    expect(missing).toMatchObject({ publications: [], continueAfter: missingIds[3] })
    expect(readBody).not.toHaveBeenCalled()
    const bodies = await base.other.caller.query(capture, {
      ...base.input,
      request: {
        kind: 'PUBLICATIONS',
        subjectIds: extra.map((document) => document.id),
        afterSubjectId: null
      }
    })
    expect(bodies).toMatchObject({
      kind: 'PUBLICATIONS',
      publications: Array.from({ length: 4 }, () =>
        expect.objectContaining({
          campaignShared: true,
          campaignParentAllowed: true,
          storedParentId: null
        })
      )
    })
    expect(readBody).toHaveBeenCalledTimes(4)
  } finally {
    readBody.mockRestore()
  }
})
