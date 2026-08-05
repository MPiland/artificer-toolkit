import {
  commitImports as commitImportBatch,
  exportAuthoredContent as exportOwnedAuthoredContent,
  handleAuthoringRequest,
  previewImports as previewImportBatch
} from '@artificer-toolkit/functions'
import {
  artificerPortableContentDtoSchema,
  authoredContentExportRequestDtoSchema,
  importBatchInputDtoSchema,
  importCommitRequestDtoSchema,
  importPreviewResponseDtoSchema,
  importResultReportDtoSchema
} from '@artificer-toolkit/schema/api/imports'

export const previewImports = handleAuthoringRequest(
  importBatchInputDtoSchema,
  async (db, input, userId) =>
    importPreviewResponseDtoSchema.parse(await previewImportBatch(db, input, userId))
)

export const commitImports = handleAuthoringRequest(
  importCommitRequestDtoSchema,
  async (db, input, userId) =>
    importResultReportDtoSchema.parse(await commitImportBatch(db, input, userId))
)

export const exportAuthoredContent = handleAuthoringRequest(
  authoredContentExportRequestDtoSchema,
  async (db, input, userId) =>
    artificerPortableContentDtoSchema.parse(await exportOwnedAuthoredContent(db, input, userId))
)
