import { describe, expect, it } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import {
  SRD_DWARVEN_HERITAGE_ID,
  SRD_GOLD_CURRENCY_ID,
  SRD_STEALTH_SKILL_ID,
  SRD_WALK_SPEED_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import {
  IMPORT_PREVIEW_LOOKUP_ARGUMENT_MAX_BYTES,
  chunkImportPreviewLookupRequests,
  createImportPreviewLookupRecorder,
  createImportPreviewMapLookup,
  importSystemVocabulary,
  loadExactRef,
  loadExactForJobRef,
  loadMasterPageRef,
  mergeImportPreviewLookupSnapshots,
  type ImportPreviewExactLookupRequest
} from './previewLookup'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const authModules = import.meta.glob('../betterAuth/**/*.*s')

async function fixture() {
  return publicationFixture(modules, authModules, [
    [
      importedSubject({
        subjectKind: 'RACE',
        id: human.id,
        systemId: human.systemId,
        label: human.label,
        document: human
      })
    ]
  ])
}

describe('native import preview lookup', () => {
  it('deduplicates recordings and chunks exact requests by count and serialized UTF-8 bytes', async () => {
    const ownerUserId = crypto.randomUUID()
    const recorder = createImportPreviewLookupRecorder(ownerUserId)
    await recorder.findActiveAuthored({
      subjectKind: 'RACE',
      subjectId: human.id
    })
    await recorder.findActiveAuthored({
      subjectKind: 'RACE',
      subjectId: human.id
    })
    await recorder.findImportReference({
      userId: ownerUserId,
      source: 'DND_BEYOND',
      subjectKind: 'RACE',
      externalId: 'human'
    })
    await recorder.findActiveMasterLabelCandidates({ subjectKind: 'RACE' })
    await recorder.findActiveMasterLabelCandidates({ subjectKind: 'RACE' })
    expect(recorder.exactRequests()).toHaveLength(2)
    expect(recorder.masterSubjectKinds()).toEqual(['RACE'])

    const requests: ImportPreviewExactLookupRequest[] = Array.from({ length: 129 }, (_, index) => ({
      kind: 'ACTIVE_AUTHORED',
      subjectKind: 'RACE',
      subjectId: `${human.id}-${index}`
    }))
    requests.push(requests[0]!)
    expect(chunkImportPreviewLookupRequests(requests).map((chunk) => chunk.length)).toEqual([
      128, 1
    ])

    const byteChunks = chunkImportPreviewLookupRequests([
      {
        kind: 'IMPORT_REFERENCE',
        source: 'DND_BEYOND',
        subjectKind: 'RACE',
        externalId: 'é'.repeat(300_000)
      },
      {
        kind: 'IMPORT_REFERENCE',
        source: 'DND_BEYOND',
        subjectKind: 'RACE',
        externalId: 'ñ'.repeat(300_000)
      }
    ])
    expect(byteChunks).toHaveLength(2)
    expect(
      byteChunks.every(
        (chunk) =>
          new TextEncoder().encode(JSON.stringify({ requests: chunk })).byteLength <=
          IMPORT_PREVIEW_LOOKUP_ARGUMENT_MAX_BYTES
      )
    ).toBe(true)
    expect(() =>
      chunkImportPreviewLookupRequests([
        {
          kind: 'IMPORT_REFERENCE',
          source: 'DND_BEYOND',
          subjectKind: 'RACE',
          externalId: 'é'.repeat(IMPORT_PREVIEW_LOOKUP_ARGUMENT_MAX_BYTES)
        }
      ])
    ).toThrow('One import preview lookup request is too large.')

    const empty = mergeImportPreviewLookupSnapshots(
      ownerUserId,
      [],
      [
        {
          subjectKind: 'RACE',
          candidates: [{ subjectId: 'first', label: 'First' }]
        },
        {
          subjectKind: 'RACE',
          candidates: [{ subjectId: 'second', label: 'Second' }]
        }
      ]
    )
    const emptyLookup = createImportPreviewMapLookup(empty)
    expect(await emptyLookup.findCharacter({ characterId: human.id })).toBeNull()
    expect(
      await emptyLookup.findActiveMasterLabelCandidates({
        subjectKind: 'RACE'
      })
    ).toEqual([
      { subjectId: 'first', label: 'First' },
      { subjectId: 'second', label: 'Second' }
    ])
  })

  it('records System vocabulary requests and serves the merged snapshot by System', async () => {
    const ownerUserId = crypto.randomUUID()
    const recorder = createImportPreviewLookupRecorder(ownerUserId)
    expect(await recorder.findSystemVocabulary({ systemId: 'system-1' })).toBeNull()
    await recorder.findSystemVocabulary({ systemId: 'system-1' })
    expect(recorder.exactRequests()).toEqual([{ kind: 'SYSTEM_VOCABULARY', systemId: 'system-1' }])

    const vocabulary = {
      systemId: 'system-1',
      damageTypes: [{ id: 'damage-1', code: 'PIERCING', label: 'Piercing' }],
      rarities: [],
      goldCurrencyId: 'currency-gold'
    }
    const part = {
      ownerUserId,
      importReferences: [],
      activeAuthored: [],
      authoredDrafts: [],
      characters: [],
      characterDrafts: [],
      systemVocabularies: [vocabulary]
    }
    const lookup = createImportPreviewMapLookup(
      mergeImportPreviewLookupSnapshots(ownerUserId, [part, part])
    )
    expect(await lookup.findSystemVocabulary({ systemId: 'system-1' })).toEqual(vocabulary)
    expect(await lookup.findSystemVocabulary({ systemId: 'system-2' })).toBeNull()
  })

  it('hydrates active root metadata without its payload version and isolates it to its owner', async () => {
    const base = await fixture()
    await base.t.run((ctx) =>
      ctx.db.insert('authoredImportRefs', {
        userId: base.first.userId,
        source: 'ARTIFICER_JSON',
        subjectKind: 'RACE',
        externalId: 'external-human',
        subjectId: human.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    )
    await base.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (query) => query.eq('id', human.id))
        .unique()
      if (!root) throw new Error('Missing master Race fixture.')
      await ctx.db.delete(root.currentVersionId)
    })
    const request: ImportPreviewExactLookupRequest = {
      kind: 'IMPORT_REFERENCE',
      source: 'ARTIFICER_JSON',
      subjectKind: 'RACE',
      externalId: 'external-human'
    }
    const first = await base.first.caller.query(loadExactRef, {
      requests: [request]
    })
    expect(first.importReferences).toEqual([
      expect.objectContaining({
        subjectId: human.id,
        externalId: 'external-human'
      })
    ])
    expect(first.activeAuthored).toEqual([
      expect.objectContaining({
        subjectId: human.id,
        label: human.label,
        isMaster: true
      })
    ])

    const lookup = createImportPreviewMapLookup(
      mergeImportPreviewLookupSnapshots(base.first.userId, [first])
    )
    expect(
      await lookup.findImportReference({
        userId: base.first.userId,
        source: 'ARTIFICER_JSON',
        subjectKind: 'RACE',
        externalId: 'external-human'
      })
    ).toEqual({ subjectId: human.id })
    expect(
      await lookup.findActiveAuthored({
        subjectKind: 'RACE',
        subjectId: human.id
      })
    ).toEqual(expect.objectContaining({ label: human.label, isMaster: true }))

    const second = await base.second.caller.query(loadExactRef, {
      requests: [request]
    })
    expect(second.importReferences).toEqual([])
    expect(second.activeAuthored).toEqual([])
  }, 15_000)

  it('paginates root metadata at 96 rows without hydrating payload versions', async () => {
    const base = await fixture()
    const jobId = await base.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (query) => query.eq('id', human.id))
        .unique()
      if (!root?.catalogue) throw new Error('Missing master Race fixture.')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Missing master Race version fixture.')
      const jobId = crypto.randomUUID()
      const previewId = crypto.randomUUID()
      const command = {
        commandId: crypto.randomUUID(),
        previewId,
        selectedEntryIds: [root.id],
        resolutions: [],
        customContentChoices: []
      }
      const now = new Date().toISOString()
      await ctx.db.insert('importJobs', {
        id: jobId,
        ownerUserId: base.first.userId,
        previewId,
        command,
        inputFingerprint: checksumCanonicalJson({
          operation: 'PORTABLE_IMPORT',
          ownerUserId: base.first.userId,
          command
        }),
        source: 'ARTIFICER_JSON',
        status: 'RUNNING',
        terminalStatus: null,
        phase: 'STAGING',
        entryIndex: 0,
        cursor: null,
        processedEntries: 0,
        totalEntries: 1,
        expectedStageCount: 1,
        stagedStageCount: 1,
        failureReason: null,
        summary: null,
        cleanupTableIndex: 0,
        cleanupCursor: null,
        expiresAt: Date.now() + 60_000,
        createdAt: now,
        updatedAt: now
      })
      await ctx.db.patch(root._id, { importJobId: jobId })
      await ctx.db.patch(version._id, { importJobId: jobId })
      const {
        _id: _rootId,
        _creationTime: _rootCreationTime,
        currentVersionId: _currentVersionId,
        ...rootFields
      } = root
      const { _id: _versionId, _creationTime: _versionCreationTime, ...versionFields } = version
      for (let index = 0; index < 100; index++) {
        const id = crypto.randomUUID()
        const label = `Master Race ${index.toString().padStart(3, '0')}`
        const document = { ...human, id, label }
        const checksum = checksumRuleDocument(document)
        const storedVersionId = await ctx.db.insert('authoredVersions', {
          ...versionFields,
          id,
          label,
          checksum,
          documentJson: JSON.stringify(document),
          versionId: crypto.randomUUID()
        })
        await ctx.db.insert('authoredRoots', {
          ...rootFields,
          id,
          label,
          checksum,
          activeNameKey: label.toLowerCase(),
          catalogue: { ...root.catalogue, nameKey: label.toLowerCase() },
          currentVersionId: storedVersionId
        })
        if (index === 0) await ctx.db.delete(storedVersionId)
      }
      return jobId
    })

    const first = await base.first.caller.query(loadMasterPageRef, {
      subjectKind: 'RACE',
      paginationOpts: { cursor: null, numItems: 500 }
    })
    expect(first.page).toHaveLength(95)
    expect(first.isDone).toBe(false)
    const own = await base.first.caller.query(loadExactForJobRef, {
      jobId,
      requests: [
        {
          kind: 'ACTIVE_AUTHORED',
          subjectKind: 'RACE',
          subjectId: human.id
        }
      ]
    })
    expect(own.activeAuthored).toEqual([
      expect.objectContaining({ subjectId: human.id, label: human.label })
    ])
    const second = await base.first.caller.query(loadMasterPageRef, {
      subjectKind: 'RACE',
      paginationOpts: { cursor: first.continueCursor, numItems: 500 }
    })
    expect(second.page).toHaveLength(5)
    expect(second.isDone).toBe(true)
    expect(new Set([...first.page, ...second.page].map((item) => item.subjectId)).size).toBe(100)
  }, 15_000)
})

describe('importSystemVocabulary', () => {
  const system = {
    damageTypes: [{ id: 'damage-piercing', code: 'PIERCING', label: 'Piercing', description: '' }],
    rarities: [{ id: 'rarity-common', code: 'COMMON', label: 'Common' }],
    currencies: [{ id: SRD_GOLD_CURRENCY_ID, code: 'GOLD', label: 'Crown' }],
    speeds: [{ id: SRD_WALK_SPEED_ID, code: 'FOOT', label: 'Foot' }],
    skills: [{ id: SRD_STEALTH_SKILL_ID, code: 'SNEAK', label: 'Sneak' }],
    heritages: [{ id: SRD_DWARVEN_HERITAGE_ID, code: 'DEEPFOLK', label: 'Deepfolk' }]
  }

  it('binds gold, walking speed, Stealth and Dwarven by definition id whatever their codes', () => {
    expect(importSystemVocabulary(system)).toEqual({
      damageTypes: [{ id: 'damage-piercing', code: 'PIERCING', label: 'Piercing' }],
      rarities: [{ id: 'rarity-common', code: 'COMMON', label: 'Common' }],
      goldCurrencyId: SRD_GOLD_CURRENCY_ID,
      walkSpeedId: SRD_WALK_SPEED_ID,
      stealthSkillId: SRD_STEALTH_SKILL_ID,
      dwarvenHeritageId: SRD_DWARVEN_HERITAGE_ID
    })
  })

  it('does not take a code match for the definition', () => {
    const vocabulary = importSystemVocabulary({
      ...system,
      currencies: [{ id: 'other-gp', code: 'GP', label: 'Gold' }],
      skills: [{ id: 'other-stealth', code: 'STEALTH', label: 'Stealth' }]
    })
    expect(vocabulary.goldCurrencyId).toBeUndefined()
    expect(vocabulary.stealthSkillId).toBeUndefined()
  })
})
