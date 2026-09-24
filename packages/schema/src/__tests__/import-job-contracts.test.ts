import { describe, expect, it } from 'vitest'
import {
  beginImportJobInputSchema,
  importJobListPageSchema,
  importJobProgressDtoSchema,
  importPreviewInputSchema,
  importPreviewResultSchema
} from '../api/importJobs.js'
import {
  authoredStoredImportReferenceSchema,
  importCommitRequestDtoSchema
} from '../api/imports.js'
import { authoredStoredDraftSchema } from '../api/authoredDrafts.js'
import {
  importStoredJobSchema,
  importStoredStageSchema,
  importStoredPreviewDescriptorSchema,
  importStoredPreviewSessionSchema
} from '../projections/importJobPersistence.js'

const id = '00000000-0000-4000-8000-000000000001'
const secondId = '00000000-0000-4000-8000-000000000002'

describe('native import job contracts', () => {
  it('accepts optional staged-row provenance and rejects malformed job IDs', () => {
    const draft = {
      subjectKind: 'EQUIPMENT' as const,
      subjectId: id,
      publicId: id,
      userId: id,
      systemId: id,
      label: 'Staged equipment',
      status: 'DRAFT' as const,
      draftState: 'DRAFT_ONLY' as const,
      baseActiveUpdatedAt: null,
      basePublishedChecksum: null,
      payloadJson: '{}',
      importJobId: secondId
    }
    expect(authoredStoredDraftSchema.parse(draft)).toMatchObject({ importJobId: secondId })
    expect(authoredStoredDraftSchema.safeParse({ ...draft, importJobId: 'invalid' }).success).toBe(
      false
    )

    const reference = {
      userId: id,
      importJobId: secondId,
      source: 'ARTIFICER_JSON' as const,
      subjectKind: 'EQUIPMENT' as const,
      externalId: 'imported-equipment',
      subjectId: id,
      createdAt: '2026-09-19T00:00:00.000Z',
      updatedAt: '2026-09-19T00:00:00.000Z'
    }
    expect(authoredStoredImportReferenceSchema.parse(reference)).toMatchObject({
      importJobId: secondId
    })
    expect(
      authoredStoredImportReferenceSchema.safeParse({ ...reference, importJobId: 'invalid' })
        .success
    ).toBe(false)
  })

  it('preserves each source shape while binding uploaded JSON to ordered claims', () => {
    const claim = { claimId: id, entryId: 'entry-1', name: 'entry.json' }
    expect(
      importPreviewInputSchema.parse({
        source: 'DND_BEYOND',
        systemId: id,
        primaryRulesCatalogueId: id,
        entries: [{ entryId: 'entry-1', url: 'https://www.dndbeyond.com/characters/1' }]
      }).entries[0]
    ).toHaveProperty('url')
    expect(
      importPreviewInputSchema.parse({
        source: 'FOUNDRY_DND5E',
        systemId: id,
        primaryRulesCatalogueId: id,
        entries: [claim]
      }).entries
    ).toEqual([claim])
    expect(
      importPreviewInputSchema.parse({
        source: 'ARTIFICER_JSON',
        entries: [claim]
      }).entries
    ).toEqual([claim])

    expect(
      importPreviewInputSchema.safeParse({
        source: 'ARTIFICER_JSON',
        entries: [claim, { ...claim, claimId: '00000000-0000-4000-8000-000000000002' }]
      }).success
    ).toBe(false)
    expect(
      importPreviewInputSchema.safeParse({
        source: 'FOUNDRY_DND5E',
        systemId: id,
        primaryRulesCatalogueId: id,
        entries: []
      }).success
    ).toBe(false)
    expect(
      importPreviewInputSchema.safeParse({
        source: 'ARTIFICER_JSON',
        entries: Array.from({ length: 26 }, (_, index) => ({
          claimId: id,
          entryId: 'entry-' + index,
          name: index + '.json'
        }))
      }).success
    ).toBe(false)
    expect(
      importPreviewInputSchema.safeParse({
        source: 'ARTIFICER_JSON',
        entries: [{ ...claim, text: '{}' }]
      }).success
    ).toBe(false)

    expect(
      importPreviewResultSchema.parse({
        source: 'ARTIFICER_JSON',
        items: [],
        summary: { ready: 0, needsReview: 0, unable: 0 },
        previewId: id,
        expiresAt: '2026-09-19T00:15:00.000Z'
      })
    ).toMatchObject({ previewId: id, source: 'ARTIFICER_JSON' })
  })

  it('stores strict source descriptors without embedding import bytes', () => {
    const longUrl = `https://www.dndbeyond.com/characters/1?${'source='.repeat(50)}`
    const dnd = importStoredPreviewDescriptorSchema.parse({
      source: 'DND_BEYOND',
      systemId: id,
      primaryRulesCatalogueId: secondId,
      entries: [{ claimId: id, entryId: 'entry-1', url: longUrl }]
    })
    expect(dnd).toMatchObject({
      systemId: id,
      primaryRulesCatalogueId: secondId,
      entries: [{ claimId: id, entryId: 'entry-1', url: longUrl }]
    })
    expect(longUrl.length).toBeGreaterThan(255)

    const claim = { claimId: id, entryId: 'entry-1', name: 'entry.json' }
    expect(
      importStoredPreviewDescriptorSchema.parse({
        source: 'FOUNDRY_DND5E',
        systemId: id,
        primaryRulesCatalogueId: secondId,
        entries: [claim]
      })
    ).toEqual({
      source: 'FOUNDRY_DND5E',
      systemId: id,
      primaryRulesCatalogueId: secondId,
      entries: [claim]
    })
    expect(
      importStoredPreviewDescriptorSchema.parse({
        source: 'ARTIFICER_JSON',
        entries: [claim]
      })
    ).toEqual({ source: 'ARTIFICER_JSON', entries: [claim] })

    const invalidDescriptors = [
      { source: 'ARTIFICER_JSON', systemId: id, entries: [claim] },
      { source: 'ARTIFICER_JSON', entries: [{ ...claim, text: '{}' }] },
      { source: 'DND_BEYOND', systemId: id, primaryRulesCatalogueId: id, entries: [] },
      {
        source: 'ARTIFICER_JSON',
        entries: [claim, { ...claim, entryId: 'entry-2' }]
      },
      {
        source: 'ARTIFICER_JSON',
        entries: [claim, { ...claim, claimId: secondId }]
      }
    ]
    for (const descriptor of invalidDescriptors)
      expect(importStoredPreviewDescriptorSchema.safeParse(descriptor).success).toBe(false)
  })
  it('keeps raw commit input and uses bounded preview-bound job commands', () => {
    expect(
      importCommitRequestDtoSchema.parse({
        batch: {
          source: 'ARTIFICER_JSON',
          entries: [{ entryId: 'entry-1', name: 'entry.json', text: '{}' }]
        },
        selectedEntryIds: ['entry-1']
      }).batch.entries[0]
    ).toMatchObject({ text: '{}' })

    expect(
      beginImportJobInputSchema.parse({
        commandId: id,
        previewId: id,
        selectedEntryIds: ['entry-1']
      })
    ).toEqual({
      commandId: id,
      previewId: id,
      selectedEntryIds: ['entry-1'],
      resolutions: [],
      customContentChoices: []
    })
    expect(
      beginImportJobInputSchema.safeParse({
        commandId: id,
        previewId: id,
        selectedEntryIds: Array.from({ length: 26 }, (_, index) => `entry-${index}`)
      }).success
    ).toBe(false)
  })

  it('stores bounded claim references and exposes phase only on detailed progress', () => {
    const now = '2026-09-19T00:00:00.000Z'
    expect(
      importStoredPreviewSessionSchema.safeParse({
        id,
        ownerUserId: id,
        source: 'ARTIFICER_JSON',
        entries: Array.from({ length: 26 }, (_, index) => ({
          claimId: id,
          entryId: `entry-${index}`,
          name: `${index}.json`
        })),
        status: 'READY',
        jobId: null,
        expiresAt: 1,
        createdAt: now,
        updatedAt: now
      }).success
    ).toBe(false)

    const legacyPreview = {
      id,
      ownerUserId: id,
      source: 'ARTIFICER_JSON' as const,
      entries: [{ claimId: id, entryId: 'entry-1', name: 'entry.json' }],
      status: 'READY' as const,
      jobId: null,
      expiresAt: 1,
      createdAt: now,
      updatedAt: now
    }
    expect(importStoredPreviewSessionSchema.parse(legacyPreview)).not.toHaveProperty('descriptor')
    expect(
      importStoredPreviewSessionSchema.safeParse({
        ...legacyPreview,
        descriptor: {
          source: 'ARTIFICER_JSON',
          entries: [{ claimId: id, entryId: 'entry-1', name: 'other.json' }]
        }
      }).success
    ).toBe(false)
    expect(
      importStoredPreviewSessionSchema.safeParse({
        ...legacyPreview,
        descriptor: {
          source: 'FOUNDRY_DND5E',
          systemId: id,
          primaryRulesCatalogueId: secondId,
          entries: legacyPreview.entries
        }
      }).success
    ).toBe(false)
    const command = beginImportJobInputSchema.parse({
      commandId: id,
      previewId: id,
      selectedEntryIds: []
    })
    const stored = importStoredJobSchema.parse({
      id,
      ownerUserId: id,
      previewId: id,
      command,
      inputFingerprint: 'a'.repeat(64),
      source: 'ARTIFICER_JSON',
      status: 'RUNNING',
      terminalStatus: null,
      phase: 'PLANNING',
      entryIndex: 0,
      cursor: null,
      processedEntries: 0,
      totalEntries: 1,
      failureReason: null,
      summary: null,
      cleanupTableIndex: 0,
      cleanupCursor: null,
      expiresAt: 1,
      createdAt: now,
      updatedAt: now
    })
    expect(stored.expectedStageCount).toBe(0)
    expect(stored.stagedStageCount).toBe(0)
    expect(
      importJobProgressDtoSchema.parse({
        jobId: stored.id,
        previewId: stored.previewId,
        source: stored.source,
        status: stored.status,
        phase: stored.phase,
        processedEntries: stored.processedEntries,
        totalEntries: stored.totalEntries,
        failureReason: stored.failureReason,
        result: null,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt
      }).phase
    ).toBe('PLANNING')
    expect(
      importJobListPageSchema.parse({
        page: [],
        isDone: true,
        continueCursor: ''
      })
    ).not.toHaveProperty('result')
  })

  it('stores bounded import stages and stage progress counts', () => {
    const now = '2026-09-19T00:00:00.000Z'
    expect(
      importStoredStageSchema.parse({
        jobId: id,
        stageKey: 'entry-1:plan',
        entryId: 'entry-1',
        sequence: 0,
        kind: 'PLAN',
        status: 'PLANNED',
        targetJson: '{}',
        outputJson: '{}',
        expectedStateJson: '{}',
        expectedStateChecksum: 'a'.repeat(64),
        createdAt: now,
        updatedAt: now
      })
    ).toMatchObject({ jobId: id, status: 'PLANNED' })

    for (const invalid of [
      {
        jobId: id,
        stageKey: '',
        entryId: 'entry-1',
        sequence: 0,
        kind: 'PLAN',
        status: 'PLANNED',
        targetJson: '{}',
        outputJson: '{}',
        expectedStateJson: '{}',
        expectedStateChecksum: 'a'.repeat(64),
        createdAt: now,
        updatedAt: now
      },
      {
        jobId: id,
        stageKey: 'entry-1:plan',
        entryId: 'entry-1',
        sequence: -1,
        kind: 'UNKNOWN',
        status: 'PLANNED',
        targetJson: '{}',
        outputJson: '{}',
        expectedStateJson: '{}',
        expectedStateChecksum: 'invalid',
        createdAt: now,
        updatedAt: now
      }
    ])
      expect(importStoredStageSchema.safeParse(invalid).success).toBe(false)

    const command = beginImportJobInputSchema.parse({
      commandId: id,
      previewId: id,
      selectedEntryIds: []
    })
    const base = {
      id,
      ownerUserId: id,
      previewId: id,
      command,
      inputFingerprint: 'a'.repeat(64),
      source: 'ARTIFICER_JSON' as const,
      status: 'RUNNING' as const,
      terminalStatus: null,
      phase: 'STAGING' as const,
      entryIndex: 0,
      cursor: null,
      processedEntries: 0,
      totalEntries: 1,
      failureReason: null,
      summary: null,
      cleanupTableIndex: 0,
      cleanupCursor: null,
      expiresAt: 1,
      createdAt: now,
      updatedAt: now
    }
    expect(
      importStoredJobSchema.parse({ ...base, expectedStageCount: 1, stagedStageCount: 1 })
    ).toMatchObject({ expectedStageCount: 1, stagedStageCount: 1 })
    expect(
      importStoredJobSchema.safeParse({ ...base, expectedStageCount: 1, stagedStageCount: 2 })
        .success
    ).toBe(false)
    expect(
      importStoredJobSchema.safeParse({ ...base, expectedStageCount: -1, stagedStageCount: 0 })
        .success
    ).toBe(false)
  })
})
