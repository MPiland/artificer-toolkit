import {
  artificerPortableContentDtoSchema,
  authoredContentExportRequestDtoSchema,
  importBatchInputDtoSchema,
  importUploadCompletionRequestDtoSchema,
  importResultReportDtoSchema,
  type ArtificerPortableContentDto,
  type AuthoredContentExportRequestDto,
  type ImportCommitRequestDto,
  type ImportResultReportDto
} from '@artificer-toolkit/schema/api/imports'
import {
  importJobProgressDtoSchema,
  importPreviewInputSchema,
  importPreviewResultSchema,
  type ImportPreviewResult
} from '@artificer-toolkit/schema/api/importJobs'
import type { ConvexReactClient } from 'convex/react'
import type { GenericId } from 'convex/values'
import { api } from '@artificer-toolkit/apis/convex/api'

export class ImportRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportRequestError'
  }
}

const IMPORT_JOB_POLL_DELAY_MS = 500

export async function previewImport(
  batch: ImportCommitRequestDto['batch'],
  client: ConvexReactClient
): Promise<ImportPreviewResult> {
  const input = importBatchInputDtoSchema.parse(batch)
  if (input.source === 'DND_BEYOND') {
    return importPreviewResultSchema.parse(
      await client.action(api.imports.preview.create, { input })
    )
  }

  const claims = await Promise.all(input.entries.map((entry) => uploadImportEntry(entry, client)))
  return importPreviewResultSchema.parse(
    await client.action(api.imports.preview.create, {
      input: importPreviewInputSchema.parse({ ...input, entries: claims })
    })
  )
}

export async function commitImport(
  input: ImportCommitRequestDto,
  previewId: string,
  client: ConvexReactClient
): Promise<ImportResultReportDto> {
  const job = await client.mutation(api.imports.jobs.begin, {
    commandId: crypto.randomUUID(),
    previewId,
    selectedEntryIds: input.selectedEntryIds,
    resolutions: input.resolutions,
    customContentChoices: input.customContentChoices
  })

  let progress = job
  while (true) {
    const parsed = importJobProgressDtoSchema.safeParse(progress)
    if (!parsed.success) throw new ImportRequestError('The import job returned an invalid status.')
    if (parsed.data.status === 'COMPLETED') {
      if (!parsed.data.result)
        throw new ImportRequestError('The completed import did not return a result.')
      return importResultReportDtoSchema.parse(parsed.data.result)
    }
    if (parsed.data.status === 'FAILED' || parsed.data.status === 'CANCELLED') {
      throw new ImportRequestError(
        parsed.data.failureReason ?? 'The import could not be completed.'
      )
    }
    await new Promise((resolve) => setTimeout(resolve, IMPORT_JOB_POLL_DELAY_MS))
    progress = await client.query(api.imports.jobs.progress, { jobId: job.jobId })
  }
}

export async function exportAuthoredContent(
  input: AuthoredContentExportRequestDto,
  client: ConvexReactClient
): Promise<ArtificerPortableContentDto> {
  const request = authoredContentExportRequestDtoSchema.parse(input)
  return artificerPortableContentDtoSchema.parse(
    await client.query(api.content.exports.get, request)
  )
}

async function uploadImportEntry(
  entry: Extract<
    ImportCommitRequestDto['batch'],
    { source: 'FOUNDRY_DND5E' | 'ARTIFICER_JSON' }
  >['entries'][number],
  client: ConvexReactClient
) {
  const claim = await client.mutation(api.imports.uploads.create, {
    entryId: entry.entryId,
    name: entry.name,
    declaredBytes: new TextEncoder().encode(entry.text).byteLength
  })
  const response = await fetch(claim.uploadUrl, {
    body: entry.text,
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok || !hasStorageId(body))
    throw new ImportRequestError('The import file could not be uploaded.')
  const completion = await client.mutation(api.imports.uploads.finalize, {
    claimId: claim.claimId,
    storageId: toStorageId(
      importUploadCompletionRequestDtoSchema.parse({
        claimId: claim.claimId,
        storageId: body.storageId
      }).storageId
    )
  })
  if (completion.status !== 'READY')
    throw new ImportRequestError('The import file could not be uploaded.')
  return { claimId: claim.claimId, entryId: entry.entryId, name: entry.name }
}

function toStorageId(storageId: string): GenericId<'_storage'> {
  return storageId as GenericId<'_storage'>
}

function hasStorageId(value: unknown): value is { storageId: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'storageId' in value &&
    typeof value.storageId === 'string' &&
    value.storageId.length > 0
  )
}
