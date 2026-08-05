import {
  artificerPortableContentDtoSchema,
  authoredContentExportRequestDtoSchema,
  importPreviewResponseDtoSchema,
  importResultReportDtoSchema,
  type ArtificerPortableContentDto,
  type AuthoredContentExportRequestDto,
  type ImportCommitRequestDto,
  type ImportPreviewResponseDto,
  type ImportResultReportDto
} from '@artificer-toolkit/schema/api/imports'
import type { z } from 'zod'
import { applySameOriginRequestHeader } from '#app/lib/trpcRequestSecurity'

export class ImportRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportRequestError'
  }
}

export function previewImport(
  batch: ImportCommitRequestDto['batch']
): Promise<ImportPreviewResponseDto> {
  return importRequest('/api/imports/preview', batch, importPreviewResponseDtoSchema)
}

export function commitImport(input: ImportCommitRequestDto): Promise<ImportResultReportDto> {
  return importRequest('/api/imports/commit', input, importResultReportDtoSchema)
}

export function exportAuthoredContent(
  input: AuthoredContentExportRequestDto
): Promise<ArtificerPortableContentDto> {
  return importRequest(
    '/api/imports/export',
    authoredContentExportRequestDtoSchema.parse(input),
    artificerPortableContentDtoSchema
  )
}

async function importRequest<TSchema extends z.ZodType>(
  path: string,
  input: unknown,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  const headers = applySameOriginRequestHeader(new Headers({ 'content-type': 'application/json' }))
  const response = await fetch(path, {
    body: JSON.stringify(input),
    credentials: 'same-origin',
    headers,
    method: 'POST'
  })

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = readErrorMessage(body) ?? 'The import could not be completed.'
    throw new ImportRequestError(message)
  }

  return schema.parse(body)
}

function readErrorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  if ('message' in body && typeof body.message === 'string') return body.message
  return 'error' in body && typeof body.error === 'string' ? body.error : null
}
