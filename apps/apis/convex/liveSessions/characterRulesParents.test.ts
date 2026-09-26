import { afterEach, expect, it, vi } from 'vitest'
import {
  liveSessionCharacterRulesInputSchema,
  type LiveSessionCharacterRulesInput,
  type LiveSessionCharacterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { clubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/club-plus-1.js'
import { elf, highElf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { prepareNativeLiveCharacterSheet } from '../../../session-worker/src/nativeCharacterRules'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { importedSubject, makePublishedRootOwned } from '../../tests/fixtures/publication'
import { internal } from '../_generated/api'
import { readCharacterRecord } from '../characters/stateDocuments'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { deleteAuthoredVersion, insertAuthoredVersion } from '../content/documents'
import { withSceneVisionTracking } from '../lib/mutations'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function setup() {
  const fixture = await setupCharacterRun()
  const authorityEpoch = crypto.randomUUID()
  await fixture.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: fixture.campaign.id,
      epoch: authorityEpoch,
      createdAt: fixture.campaign.createdAt
    })
  )
  const scope: Omit<LiveSessionCharacterRulesInput, 'request'> = {
    campaignId: fixture.campaign.id,
    authorityEpoch,
    expectedUserId: fixture.owner.userId,
    expectedRole: 'OWNER',
    characterId: fixture.character.id
  }
  const secret = 'private-character-parent-test-secret-at-least-32-bytes'
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  const requests: LiveSessionCharacterRulesRequest[] = []
  async function prepare(
    afterResponse?: (request: LiveSessionCharacterRulesRequest) => Promise<void>
  ) {
    requests.length = 0
    stubLiveSessionFetch(async (path, init) => {
      expect(path).toBe('/live-sessions/character-rules')
      const headers = new Headers(init?.headers)
      expect(headers.get('authorization')).toBe('Bearer fixture-access-token')
      expect(headers.get('x-artificer-live-session-secret')).toBe(secret)
      if (typeof init?.body !== 'string') throw new Error('Missing capture body.')
      const input = liveSessionCharacterRulesInputSchema.parse(JSON.parse(init.body))
      requests.push(input.request)
      const response = await fixture.owner.caller.fetch(path, init)
      await afterResponse?.(input.request)
      return response
    })
    return prepareNativeLiveCharacterSheet(workerEnvironment(secret), 'fixture-access-token', scope)
  }
  async function share(
    subjectKind: 'EQUIPMENT' | 'RACE' | 'CLASS',
    subjectId: string,
    sharedBy: string
  ) {
    return fixture.t.run((ctx) =>
      ctx.db.insert('campaignContentShares', {
        campaignId: fixture.campaign.id,
        subjectKind,
        subjectId,
        sharedBy,
        createdAt: fixture.campaign.createdAt,
        updatedAt: fixture.campaign.createdAt
      })
    )
  }
  return { fixture, scope, prepare, requests, share }
}

it('requires a share of the private Equipment parent and preserves prepared facts after sharing', async () => {
  const { fixture, scope, prepare, share } = await setup()
  const parent = { ...club, id: crypto.randomUUID(), label: 'Private parent' }
  const variant = {
    ...clubPlus1,
    id: crypto.randomUUID(),
    label: 'Shared variant',
    parentEquipmentId: parent.id
  }
  const unrelated = { ...club, id: crypto.randomUUID(), label: 'Unrelated private item' }
  await fixture.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [parent, variant, unrelated].map((document) =>
      importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
    )
  })
  await fixture.t.run(async (ctx) => {
    await makePublishedRootOwned(ctx, parent.id, fixture.player.userId)
    await makePublishedRootOwned(ctx, variant.id, fixture.owner.userId)
    await makePublishedRootOwned(ctx, unrelated.id, fixture.owner.userId)
    const active = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
      .unique()
    if (!active) throw new Error('Missing Character fixture.')
    const character = readCharacterRecord(active)
    character.state.equipment.inventory = [
      { id: crypto.randomUUID(), equipmentId: variant.id, quantity: 1 }
    ]
    await ctx.db.patch(active._id, {
      documentJson: canonicalizeRuleDocument(character),
      checksum: checksumRuleDocument(character)
    })
  })
  await share('EQUIPMENT', variant.id, fixture.owner.userId)
  await expect(prepare()).rejects.toThrow(/Readable parent Equipment|readable parent/i)
  const privateRead = await fixture.owner.caller.fetch('/live-sessions/character-rules', {
    method: 'POST',
    headers: {
      'x-artificer-live-session-secret': 'private-character-parent-test-secret-at-least-32-bytes'
    },
    body: JSON.stringify({
      ...scope,
      request: { kind: 'PUBLICATIONS', subjectIds: [unrelated.id], afterSubjectId: null }
    })
  })
  expect(privateRead.status).toBe(200)
  expect((await privateRead.json()).publications).toEqual([])
  const parentShare = await share('EQUIPMENT', parent.id, fixture.player.userId)
  const actual = await prepare()
  await fixture.owner.caller.run(async (ctx) => {
    const expected = await loadCharacterSheetFacts(
      ctx,
      fixture.owner.userId,
      fixture.character.id,
      fixture.campaign.id
    )
    if (!expected) throw new Error('Missing Character facts.')
    expect(actual.prepared.character).toEqual(expected.prepared.character)
    expect(actual.prepared.resolution).toEqual(expected.prepared.resolution)
    expect(actual.ruleEvaluation).toEqual(expected.ruleEvaluation)
  })
  expect(actual.sourceIdentities.map((row) => row.subjectId)).toContain(parent.id)
  await fixture.t.run((ctx) => ctx.db.delete(parentShare))
  await expect(prepare()).rejects.toThrow(/Readable parent Equipment|readable parent/i)
  await share('EQUIPMENT', parent.id, fixture.player.userId)
  await fixture.t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', parent.id))
      .unique()
    if (!root) throw new Error('Missing Equipment parent.')
    await ctx.db.patch(root._id, { parentEquipmentId: variant.id })
  })
  await expect(prepare()).rejects.toThrow(/metadata mismatch/i)
})

it('rejects malformed stored Race parent metadata for a shared subrace', async () => {
  const { fixture, prepare, share } = await setup()
  const parent = { ...elf, id: crypto.randomUUID(), label: 'Private Elf' }
  const child = {
    ...highElf,
    id: crypto.randomUUID(),
    label: 'Shared High Elf',
    parentRaceId: parent.id
  }
  await fixture.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [parent, child].map((document) =>
      importedSubject({ subjectKind: 'RACE', ...document, document })
    )
  })
  await fixture.t.run(async (ctx) => {
    await makePublishedRootOwned(ctx, parent.id, fixture.player.userId)
    await makePublishedRootOwned(ctx, child.id, fixture.owner.userId)
    const active = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
      .unique()
    if (!active) throw new Error('Missing Character fixture.')
    const character = readCharacterRecord(active)
    character.intent.race = { raceId: parent.id, subraceId: child.id }
    await ctx.db.patch(active._id, {
      documentJson: canonicalizeRuleDocument(character),
      checksum: checksumRuleDocument(character)
    })
  })
  await share('RACE', child.id, fixture.owner.userId)
  await share('RACE', parent.id, fixture.player.userId)
  await expect(prepare()).rejects.toThrow('Character requires Builder repair')
  await fixture.t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', parent.id))
      .unique()
    if (!root) throw new Error('Missing Race parent.')
    await ctx.db.patch(root._id, { parentRaceId: child.id })
  })
  await expect(prepare()).rejects.toThrow(/readable base Race/i)
})

it('uses every paged Class catalogue candidate and rejects a share revision between pages', async () => {
  const { fixture, prepare, requests, share } = await setup()
  const classes = Array.from({ length: 5 }, (_, index) => ({
    ...fixture.baseClass,
    id: crypto.randomUUID(),
    label: `Shared Class ${index}`
  }))
  const inactive = { ...fixture.baseClass, id: crypto.randomUUID(), label: 'Inactive shared Class' }
  await fixture.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [...classes, inactive, championMartialArchetype].map((document) =>
      importedSubject({ subjectKind: 'CLASS', ...document, document })
    )
  })
  await fixture.t.run(async (ctx) => {
    for (const record of [...classes, inactive])
      await makePublishedRootOwned(ctx, record.id, fixture.owner.userId)
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', inactive.id))
      .unique()
    if (!root) throw new Error('Missing inactive Class root.')
    const version = await ctx.db.get(root.currentVersionId)
    if (!version) throw new Error('Missing inactive Class version.')
    const document = { ...(await deleteAuthoredVersion(ctx, version)), status: 'DRAFT' as const }
    const checksum = checksumRuleDocument(document)
    const currentVersionPublicId = crypto.randomUUID()
    const currentVersionId = await insertAuthoredVersion(
      ctx,
      {
        subjectKind: version.subjectKind,
        id: version.id,
        systemId: version.systemId,
        label: version.label,
        checksum,
        contentSourceId: version.contentSourceId,
        versionId: currentVersionPublicId,
        version: version.version,
        documentSchemaVersion: version.documentSchemaVersion,
        compilation: version.compilation
      },
      canonicalizeRuleDocument(document)
    )
    await ctx.db.patch(root._id, { checksum, currentVersionId, currentVersionPublicId })
    const active = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
      .unique()
    if (!active) throw new Error('Missing Character fixture.')
    const character = readCharacterRecord(active)
    character.intent.classes[0] = {
      ...character.intent.classes[0]!,
      classLevel: 3,
      subclassId: championMartialArchetype.id
    }
    character.intent.hitpoints.levels = [
      character.intent.hitpoints.levels[0]!,
      { level: 2, classId: fixture.baseClass.id, classLevel: 2, value: 6 },
      { level: 3, classId: fixture.baseClass.id, classLevel: 3, value: 6 }
    ]
    await ctx.db.patch(active._id, {
      documentJson: canonicalizeRuleDocument(character),
      checksum: checksumRuleDocument(character)
    })
  })
  const shares: Awaited<ReturnType<typeof share>>[] = []
  for (const record of [...classes, inactive])
    shares.push(await share('CLASS', record.id, fixture.owner.userId))
  const actual = await prepare()
  expect(requests.filter((request) => request.kind === 'CLASS_CATALOGUE').length).toBeGreaterThan(1)
  expect(
    classes
      .map((record) => record.id)
      .every((id) => actual.prepared.context.catalog.classes.some((entry) => entry.id === id))
  ).toBe(true)
  expect(actual.prepared.context.catalog.classes.some((entry) => entry.id === inactive.id)).toBe(
    false
  )
  await expect(
    prepare(async (request) => {
      if (request.kind === 'CLASS_CATALOGUE' && !request.cursor)
        await fixture.t.run((rawCtx) => withSceneVisionTracking(rawCtx).db.delete(shares[0]!))
    })
  ).rejects.toThrow()
  expect(requests.filter((request) => request.kind === 'CLASS_CATALOGUE').length).toBeGreaterThan(1)
})

it('rejects 501 direct Class headers before loading catalogue bodies', async () => {
  const { fixture, prepare, requests } = await setup()
  const addedIds = Array.from({ length: 500 }, () => crypto.randomUUID())
  for (let offset = 0; offset < addedIds.length; offset += 50) {
    await fixture.t.run(async (ctx) => {
      const template = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.baseClass.id))
        .unique()
      if (!template) throw new Error('Missing Class template root.')
      const version = await ctx.db.get(template.currentVersionId)
      if (!version) throw new Error('Missing Class template version.')
      const { _id: _rootId, _creationTime: _rootTime, ...root } = template
      for (const [index, id] of addedIds.slice(offset, offset + 50).entries()) {
        const document = { ...fixture.baseClass, id, label: `Bound Class ${offset + index}` }
        const checksum = checksumRuleDocument(document)
        const currentVersionPublicId = crypto.randomUUID()
        const currentVersionId = await insertAuthoredVersion(
          ctx,
          {
            subjectKind: 'CLASS',
            id,
            systemId: template.systemId,
            label: document.label,
            checksum,
            contentSourceId: template.contentSourceId,
            versionId: currentVersionPublicId,
            version: version.version,
            documentSchemaVersion: version.documentSchemaVersion
          },
          canonicalizeRuleDocument(document)
        )
        await ctx.db.insert('authoredRoots', {
          ...root,
          id,
          label: document.label,
          checksum,
          currentVersionId,
          currentVersionPublicId,
          ...(root.authoringSources
            ? { authoringSources: { ...root.authoringSources, checksum } }
            : {})
        })
      }
    })
  }
  await fixture.t.run(async (ctx) => {
    const active = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
      .unique()
    if (!active) throw new Error('Missing Character fixture.')
    const character = readCharacterRecord(active)
    character.intent.classes[0] = { ...character.intent.classes[0]!, classLevel: 3 }
    await ctx.db.patch(active._id, {
      documentJson: canonicalizeRuleDocument(character),
      checksum: checksumRuleDocument(character)
    })
  })
  await expect(prepare()).rejects.toThrow(
    'Character authorized sources exceed the bounded catalogue limit.'
  )
  expect(requests.some((request) => request.kind === 'CLASS_CATALOGUE')).toBe(true)
  const added = new Set<string>(addedIds)
  expect(
    requests
      .filter((request) => request.kind === 'PUBLICATIONS')
      .every((request) => !request.subjectIds.some((id) => added.has(id)))
  ).toBe(true)
})
