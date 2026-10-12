import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  commitImport,
  exportAuthoredContent,
  ImportRequestError,
  previewImport
} from './importClient'

const client = new ConvexReactClient('https://unit-test.convex.cloud')
const claimId = '00000000-0000-4000-8000-000000000111'
const previewId = '00000000-0000-4000-8000-000000000222'
const jobId = '00000000-0000-4000-8000-000000000333'
const now = '2026-09-20T00:00:00.000Z'
const result = {
  source: 'ARTIFICER_JSON' as const,
  items: [],
  summary: { created: 0, updated: 0, skipped: 0, failed: 0 }
}
const completedJob = {
  jobId,
  previewId,
  source: 'ARTIFICER_JSON' as const,
  status: 'COMPLETED' as const,
  phase: 'PUBLISHING' as const,
  processedEntries: 1,
  totalEntries: 1,
  failureReason: null,
  createdAt: now,
  updatedAt: now,
  result
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('native import transport', () => {
  it('previews D&D Beyond directly through Convex without REST', async () => {
    const action = vi.spyOn(client, 'action').mockResolvedValue({
      source: 'DND_BEYOND',
      items: [],
      summary: { ready: 0, needsReview: 0, unable: 0 },
      previewId,
      expiresAt: now
    })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    await previewImport(
      {
        source: 'DND_BEYOND',
        systemId: '00000000-0000-4000-8000-000000000001',
        primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000002',
        entries: [{ entryId: 'link-1', url: 'https://www.dndbeyond.com/characters/1' }]
      },
      client
    )

    expect(getFunctionName(action.mock.calls[0]![0])).toBe(
      getFunctionName(api.imports.preview.create)
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uploads JSON claims before previewing through Convex without REST', async () => {
    const mutation = vi
      .spyOn(client, 'mutation')
      .mockResolvedValueOnce({
        claimId,
        uploadUrl: 'https://upload.example.invalid',
        expiresAt: now
      })
      .mockResolvedValueOnce({ claimId, status: 'READY' })
    const action = vi.spyOn(client, 'action').mockResolvedValue({
      source: 'ARTIFICER_JSON',
      items: [],
      summary: { ready: 0, needsReview: 0, unable: 0 },
      previewId,
      expiresAt: now
    })
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ storageId: 'storage-id' }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    await previewImport(
      {
        source: 'ARTIFICER_JSON',
        entries: [{ entryId: 'file-1', name: 'content.json', text: '{"kind":"FEAT"}' }]
      },
      client
    )

    expect(getFunctionName(mutation.mock.calls[0]![0])).toBe(
      getFunctionName(api.imports.uploads.create)
    )
    expect(mutation.mock.calls[0]![1]).toMatchObject({ declaredBytes: 15, entryId: 'file-1' })
    expect(fetch).toHaveBeenCalledWith(
      'https://upload.example.invalid',
      expect.objectContaining({ body: '{"kind":"FEAT"}', method: 'POST' })
    )
    expect(getFunctionName(mutation.mock.calls[1]![0])).toBe(
      getFunctionName(api.imports.uploads.finalize)
    )
    expect(mutation.mock.calls[1]![1]).toEqual({ claimId, storageId: 'storage-id' })
    expect(getFunctionName(action.mock.calls[0]![0])).toBe(
      getFunctionName(api.imports.preview.create)
    )
    expect(action.mock.calls[0]![1]).toMatchObject({
      input: { entries: [{ claimId, entryId: 'file-1', name: 'content.json' }] }
    })
    expect(fetch.mock.calls.some(([url]) => String(url).startsWith('/api/imports'))).toBe(false)
  })

  it('waits for a durable import job to complete', async () => {
    const mutation = vi
      .spyOn(client, 'mutation')
      .mockResolvedValue({ ...completedJob, status: 'RUNNING', result: null })
    const query = vi.spyOn(client, 'query').mockResolvedValue(completedJob)

    await expect(
      commitImport(
        {
          batch: {
            source: 'ARTIFICER_JSON',
            entries: [{ entryId: 'file-1', name: 'content.json', text: '{}' }]
          },
          selectedEntryIds: ['file-1'],
          resolutions: [],
          customContentChoices: []
        },
        previewId,
        client
      )
    ).resolves.toEqual(result)

    expect(getFunctionName(mutation.mock.calls[0]![0])).toBe(
      getFunctionName(api.imports.jobs.begin)
    )
    expect(mutation.mock.calls[0]![1]).toMatchObject({ previewId, selectedEntryIds: ['file-1'] })
    expect(getFunctionName(query.mock.calls[0]![0])).toBe(
      getFunctionName(api.imports.jobs.progress)
    )
  })

  it('rejects a terminal import failure', async () => {
    vi.spyOn(client, 'mutation').mockResolvedValue({
      ...completedJob,
      status: 'FAILED',
      phase: 'CLEANING',
      failureReason: 'Import data is unavailable.',
      result: null
    })

    await expect(
      commitImport(
        {
          batch: {
            source: 'ARTIFICER_JSON',
            entries: [{ entryId: 'file-1', name: 'content.json', text: '{}' }]
          },
          selectedEntryIds: ['file-1'],
          resolutions: [],
          customContentChoices: []
        },
        previewId,
        client
      )
    ).rejects.toBeInstanceOf(ImportRequestError)
  })
})

describe('authored export transport', () => {
  it.each([
    'BACKGROUND',
    'CLASS',
    'FEAT',
    'EQUIPMENT',
    'RACE',
    'CREATURE',
    'SPELL',
    'VEHICLE'
  ] as const)('exports %s through the current native client', async (subjectKind) => {
    const content = {
      format: 'artificer-content',
      version: 1,
      item: {
        kind: subjectKind,
        data: { id: 'item-id', nested: [{ id: 'nested-id' }] }
      },
      references: [
        {
          kind: 'FEAT',
          id: 'reference-id',
          label: 'Imported feat',
          importSource: 'ARTIFICER_JSON',
          importId: 'external-id'
        }
      ]
    }
    const query = vi.spyOn(client, 'query').mockResolvedValue(content)
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const request = { subjectKind, id: 'public-id', view: 'draft' as const }
    expect(await exportAuthoredContent(request, client)).toEqual(content)
    expect(getFunctionName(query.mock.calls[0]![0])).toBe(getFunctionName(api.content.exports.get))
    expect(query.mock.calls[0]![1]).toEqual(request)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('validates native output before downloading it', async () => {
    vi.spyOn(client, 'query').mockResolvedValue({ format: 'wrong' })
    await expect(
      exportAuthoredContent({ subjectKind: 'FEAT', id: 'item-id', view: 'active' }, client)
    ).rejects.toThrow()
  })
})
